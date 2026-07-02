#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, Bytes, BytesN, Env};

#[cfg(feature = "nethermind-verifier")]
use ultrahonk_soroban_verifier::UltraHonkVerifier as NethermindUltraHonkVerifier;

#[cfg(feature = "static-vk")]
const STATIC_VK: &[u8] = include_bytes!("../../../circuits/claim/target/vk");

#[contract]
pub struct InsurancePool;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Product {
    pub premium: i128,
    pub payout: i128,
    pub threshold: u64,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Policy {
    pub holder: Address,
    pub product_id: u64,
    pub expiry: u64,
    pub active: bool,
    pub paid: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
enum DataKey {
    Admin,
    Token,
    ProductSeq,
    PolicySeq,
    OraclePublicKeyX,
    OraclePublicKeyY,
    Product(u64),
    Policy(u64),
    Nullifier(BytesN<32>),
    Event(u64),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    ProductNotFound = 2,
    PolicyNotFound = 3,
    InactivePolicy = 4,
    ExpiredPolicy = 5,
    AlreadyClaimed = 6,
    BadOracleCommitment = 7,
    BadThreshold = 8,
    EmptyProof = 9,
    VerificationFailed = 10,
    EventNotFound = 11,
    OracleKeyNotSet = 12,
}

#[contractimpl]
impl InsurancePool {
    pub fn init(env: Env, admin: Address, token: Address) {
        assert!(!env.storage().instance().has(&DataKey::Admin), "already initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::ProductSeq, &0u64);
        env.storage().instance().set(&DataKey::PolicySeq, &0u64);
    }

    pub fn set_oracle_key(env: Env, public_key_x: BytesN<32>, public_key_y: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::OraclePublicKeyX, &public_key_x);
        env.storage().instance().set(&DataKey::OraclePublicKeyY, &public_key_y);
    }

    pub fn create_product(
        env: Env,
        premium: i128,
        payout: i128,
        threshold: u64,
    ) -> u64 {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let id: u64 = env.storage().instance().get(&DataKey::ProductSeq).unwrap_or(0);
        let next = id + 1;
        let product = Product {
            premium,
            payout,
            threshold,
            active: true,
        };
        env.storage().persistent().set(&DataKey::Product(id), &product);
        env.storage().instance().set(&DataKey::ProductSeq, &next);
        id
    }

    pub fn buy_policy(env: Env, holder: Address, product_id: u64, duration_seconds: u64) -> Result<u64, Error> {
        holder.require_auth();
        let product: Product = env
            .storage()
            .persistent()
            .get(&DataKey::Product(product_id))
            .ok_or(Error::ProductNotFound)?;
        if !product.active {
            return Err(Error::InactivePolicy);
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);
        client.transfer(&holder, &env.current_contract_address(), &product.premium);

        let id: u64 = env.storage().instance().get(&DataKey::PolicySeq).unwrap_or(0);
        let next = id + 1;
        let expiry = env.ledger().timestamp() + duration_seconds;
        let policy = Policy {
            holder: holder.clone(),
            product_id,
            expiry,
            active: true,
            paid: false,
        };
        env.storage().persistent().set(&DataKey::Policy(id), &policy);
        env.storage().instance().set(&DataKey::PolicySeq, &next);
        Ok(id)
    }

    pub fn publish_event(env: Env, policy_id: u64, oracle_commitment: BytesN<32>) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if !env.storage().persistent().has(&DataKey::Policy(policy_id)) {
            return Err(Error::PolicyNotFound);
        }
        env.storage().persistent().set(&DataKey::Event(policy_id), &oracle_commitment);
        Ok(())
    }

    pub fn claim(
        env: Env,
        policy_id: u64,
        proof_blob: Bytes,
        nullifier: BytesN<32>,
    ) -> Result<(), Error> {
        let mut policy: Policy = env
            .storage()
            .persistent()
            .get(&DataKey::Policy(policy_id))
            .ok_or(Error::PolicyNotFound)?;
        if !policy.active || policy.paid {
            return Err(Error::InactivePolicy);
        }
        if env.ledger().timestamp() >= policy.expiry {
            return Err(Error::ExpiredPolicy);
        }
        if env.storage().persistent().has(&DataKey::Nullifier(nullifier.clone())) {
            return Err(Error::AlreadyClaimed);
        }

        let oracle_commitment: BytesN<32> = env
            .storage()
            .persistent()
            .get(&DataKey::Event(policy_id))
            .ok_or(Error::EventNotFound)?;

        let product: Product = env
            .storage()
            .persistent()
            .get(&DataKey::Product(policy.product_id))
            .ok_or(Error::ProductNotFound)?;

        let oracle_public_key_x: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::OraclePublicKeyX)
            .ok_or(Error::OracleKeyNotSet)?;
        let oracle_public_key_y: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::OraclePublicKeyY)
            .ok_or(Error::OracleKeyNotSet)?;

        let public_inputs = Self::pack_public_inputs(
            &env,
            oracle_commitment,
            policy_id,
            product.threshold,
            nullifier.clone(),
            oracle_public_key_x,
            oracle_public_key_y,
        );
        Self::verify_ultrahonk(&env, &public_inputs, &proof_blob)?;

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);
        client.transfer(&env.current_contract_address(), &policy.holder, &product.payout);

        env.storage().persistent().set(&DataKey::Nullifier(nullifier), &true);
        policy.paid = true;
        policy.active = false;
        env.storage().persistent().set(&DataKey::Policy(policy_id), &policy);
        Ok(())
    }

    pub fn get_product(env: Env, product_id: u64) -> Result<Product, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Product(product_id))
            .ok_or(Error::ProductNotFound)
    }

    pub fn get_policy(env: Env, policy_id: u64) -> Result<Policy, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Policy(policy_id))
            .ok_or(Error::PolicyNotFound)
    }

    pub fn get_event(env: Env, policy_id: u64) -> Result<BytesN<32>, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Event(policy_id))
            .ok_or(Error::EventNotFound)
    }

    pub fn get_oracle_key_x(env: Env) -> Result<BytesN<32>, Error> {
        env.storage()
            .instance()
            .get(&DataKey::OraclePublicKeyX)
            .ok_or(Error::OracleKeyNotSet)
    }

    pub fn get_oracle_key_y(env: Env) -> Result<BytesN<32>, Error> {
        env.storage()
            .instance()
            .get(&DataKey::OraclePublicKeyY)
            .ok_or(Error::OracleKeyNotSet)
    }

    pub fn nullifier_used(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Nullifier(nullifier))
    }

    pub(crate) fn pack_public_inputs(
        env: &Env,
        oracle_commitment: BytesN<32>,
        policy_id: u64,
        threshold: u64,
        nullifier: BytesN<32>,
        oracle_public_key_x: BytesN<32>,
        oracle_public_key_y: BytesN<32>,
    ) -> Bytes {
        let mut out = Bytes::new(env);
        out.append(&Bytes::from_array(env, &oracle_commitment.to_array()));
        out.append(&Self::field_bytes_from_u64(env, policy_id));
        out.append(&Self::field_bytes_from_u64(env, threshold));
        out.append(&Bytes::from_array(env, &nullifier.to_array()));
        out.append(&Bytes::from_array(env, &oracle_public_key_x.to_array()));
        out.append(&Bytes::from_array(env, &oracle_public_key_y.to_array()));
        for value in 6..18 {
            out.append(&Self::field_bytes_from_u64(env, value));
        }
        out
    }

    fn field_bytes_from_u64(env: &Env, value: u64) -> Bytes {
        let mut bytes = [0u8; 32];
        bytes[24..32].copy_from_slice(&value.to_be_bytes());
        Bytes::from_array(env, &bytes)
    }

    fn verify_ultrahonk(env: &Env, public_inputs: &Bytes, proof: &Bytes) -> Result<(), Error> {
        #[cfg(feature = "static-vk")]
        let vk_bytes = Bytes::from_slice(env, &STATIC_VK[..1760]);
        #[cfg(feature = "nethermind-verifier")]
        {
            let verifier = NethermindUltraHonkVerifier::new(env, &vk_bytes).expect("Failed to load VK");
            verifier.verify(env, proof, public_inputs).map_err(|_| Error::VerificationFailed)?;
            return Ok(());
        }
        #[cfg(not(all(feature = "static-vk", feature = "nethermind-verifier")))]
        {
            let _ = public_inputs;
            let _ = proof;
            panic!("Verifier features not enabled");
        }
    }
}

mod test;
