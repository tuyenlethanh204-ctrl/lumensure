import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";

const CONFIG = {
  network: "testnet",
  networkLabel: "Stellar testnet",
  sourceAccount: "deployer",
  publicDomain: "https://lumensure.vercel.app",
  deployerPublicKey: "GB4W3UIOBSERQ45D5KU2L56WN4CZJBOKR7KXUH4QFCW2TACCZJOOBH43",
  insuranceContract: "CBMRHKVESDGT54LRSHVFQ2F7OS6O4VKZ2665RAT4BGVNKS3BHZK6TIYW",
  nativeTokenContract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  policyId: 1,
  productId: 0,
  nullifier: "01b0c7c47ce498044496c78ded485186f5bc7c5254a0a77e3abda249f5596758",
  wasmHash: "1002df92bb57042947bee3e1e66eabbeb9b7275edc4729786878a665e217f306",
  tx: {
    upload: "3a69561b6c1c9dde9d1096b86d3bbf89a8b288680a9a3804195ebe8aebee8244",
    deploy: "37f00e437ef58a60d627db40f64631c3907f251828d78dc11dee02fb5d002ee0",
    init: "a1cda63341b1d4430de9981f88cf57fb56f4ed728af8c3e724e64b367ebdb8a3",
    setOracleKey: "21eb35e7d10e551fde9fc9d6a9af9d437b586192846dd525b4f151a9b32c28e2",
    createProduct: "7a52e7cb376e1ce0e08d654a9feff53ce8d24b16e91878c67088eec17116234f",
    buyPolicy0: "b4d80378f8167aa5208cc6343f10255cbe599a476e40dd55a0a45dc64df10137",
    buyPolicy1: "e0fc2c1b362977877b2917e42186e9c67df2dd2e2ebce104e5bed1c0a507431f",
    publishEvent: "10a3e0284fd7f4c5867265bd322de70e68ec2a3d2ad3988e6a45128097cd4ca6",
    reserveTransfer: "ac667d4e40398846726d56e43bd417e6131ec825beef518e0ad0e4d2f8fdace0",
    claim: "0c9aafdff6461833c099ed93a28d5bc9d92b8ff1835fcd4d05abdc7f8bc5b5b6",
  },
};

function runStellar(args) {
  return execFileSync("stellar", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function invoke(contractId, fn, args = []) {
  return runStellar([
    "contract",
    "invoke",
    "--id",
    contractId,
    "--source-account",
    CONFIG.sourceAccount,
    "--network",
    CONFIG.network,
    "--send",
    "no",
    "--",
    fn,
    ...args,
  ]);
}

function parseCliValue(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function short(value, head = 8, tail = 6) {
  const s = String(value ?? "");
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

function explorerTx(hash) {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

function navIcon(name) {
  const icons = {
    overview: '<path d="M3.5 10.5 12 3l8.5 7.5v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-9Z"/><path d="M9 21v-6h6v6"/>',
    policy: '<path d="M7 6c0-1.7 2.2-3 5-3s5 1.3 5 3-2.2 3-5 3-5-1.3-5-3Z"/><path d="M7 6v5c0 1.7 2.2 3 5 3s5-1.3 5-3V6M7 11v5c0 1.7 2.2 3 5 3s5-1.3 5-3v-5"/>',
    proof: '<path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM10 5h4M10 19h4M7 11v3M17 11v3"/>',
    oracle: '<path d="M4 8h16M6 5h12M5 8v12h14V8M8 12h8M8 16h8"/>',
    reserve: '<path d="M12 7c4.5-5 9.5.5 5 5 4.5 4.5-.5 10-5 5-4.5 5-9.5-.5-5-5-4.5-4.5.5-10 5-5Z"/><path d="M12 7v10M7 12h10"/>',
    evidence: '<path d="M6 3h9l3 3v15H6V3Z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${icons[name] ?? icons.overview}</svg>`;
}

function txRow(action, hash) {
  return `
    <a class="tx-row" href="${explorerTx(hash)}" target="_blank" rel="noreferrer">
      <span>${escapeHtml(action)}</span>
      <strong>${short(hash, 10, 8)}</strong>
      <em>-></em>
    </a>`;
}

function metric(label, value, note) {
  return `
    <article class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(note)}</p>
    </article>`;
}

function detail(label, value, code = false) {
  return `
    <div class="detail">
      <span>${escapeHtml(label)}</span>
      ${code ? `<code>${escapeHtml(value)}</code>` : `<strong>${escapeHtml(value)}</strong>`}
    </div>`;
}

const onchain = {
  product: parseCliValue(invoke(CONFIG.insuranceContract, "get_product", ["--product_id", String(CONFIG.productId)])),
  policy: parseCliValue(invoke(CONFIG.insuranceContract, "get_policy", ["--policy_id", String(CONFIG.policyId)])),
  eventCommitment: parseCliValue(invoke(CONFIG.insuranceContract, "get_event", ["--policy_id", String(CONFIG.policyId)])),
  oracleKeyX: parseCliValue(invoke(CONFIG.insuranceContract, "get_oracle_key_x")),
  oracleKeyY: parseCliValue(invoke(CONFIG.insuranceContract, "get_oracle_key_y")),
  nullifierUsed: parseCliValue(invoke(CONFIG.insuranceContract, "nullifier_used", ["--nullifier", CONFIG.nullifier])),
  insuranceBalance: parseCliValue(invoke(CONFIG.nativeTokenContract, "balance", ["--id", CONFIG.insuranceContract])),
  deployerBalance: parseCliValue(invoke(CONFIG.nativeTokenContract, "balance", ["--id", CONFIG.sourceAccount])),
  fetchedAt: new Date().toISOString(),
};

const paid = Boolean(onchain.policy?.paid);
const status = paid && onchain.nullifierUsed ? "Claim paid on-chain" : "On-chain state open";

mkdirSync("web/dist", { recursive: true });
copyFileSync("web/assets/lumensure-logo.svg", "web/dist/lumensure-logo.svg");
copyFileSync("web/assets/lumensure-mark.svg", "web/dist/lumensure-mark.svg");
writeFileSync("web/dist/onchain-snapshot.json", JSON.stringify({ config: CONFIG, onchain }, null, 2));
writeFileSync(
  "web/dist/index.html",
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LumenSure | Private insurance on Stellar</title>
  <link rel="icon" href="./lumensure-mark.svg" type="image/svg+xml" />
  <style>
    @font-face{font-family:KHTeka;src:url("https://fonts.reown.com/KHTeka-Regular.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}
    @font-face{font-family:KHTeka;src:url("https://fonts.reown.com/KHTeka-Medium.woff2") format("woff2");font-weight:500;font-style:normal;font-display:swap}
    @font-face{font-family:KHTeka;src:url("https://fonts.reown.com/KHTeka-Light.woff2") format("woff2");font-weight:300;font-style:normal;font-display:swap}
    @font-face{font-family:KHTekaMono;src:url("https://fonts.reown.com/KHTekaMono-Regular.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}
    *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    :root{
      --page:#f6f6f9;
      --card:#fff;
      --ink:#050505;
      --muted:#8f929b;
      --line:#ececf2;
      --blue:#1238ff;
      --link:#6548ff;
      --lavender:#bfc8f4;
      --green:#2bdc8a;
      --soft:#fafafe;
      font-family:KHTeka,Arial,sans-serif;
      color:var(--ink);
      background:var(--page);
    }
    html,body{min-height:100vh;background:var(--page);overflow-x:hidden}
    body{font-size:18px;line-height:1.25}
    a{color:inherit;text-decoration:none}
    a:focus-visible,button:focus-visible{outline:2px solid var(--blue);outline-offset:3px}
    button{font:inherit}
    .app{width:100%;min-height:100vh;display:grid;grid-template-columns:304px 1fr;background:var(--page)}
    .left-glow{position:fixed;left:0;top:0;width:304px;height:100vh;background:linear-gradient(180deg,#b8c9ff 0%,rgba(184,201,255,0) 74%);pointer-events:none}
    .sidebar{position:sticky;top:24px;margin:24px 0 24px 24px;width:280px;height:calc(100vh - 48px);background:var(--card);border-radius:12px;display:flex;flex-direction:column;padding:28px 18px;z-index:1;box-shadow:0 24px 60px rgba(28,38,96,.08)}
    .brand{display:flex;align-items:center;margin-bottom:34px}
    .brand img{display:block;width:196px;height:auto}
    .nav{display:grid;gap:28px;padding:0 12px}
    .nav a{display:flex;align-items:center;gap:14px;font-size:20px;font-weight:500}
    .nav svg{width:22px;height:22px;stroke:#050505;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round}
    .nav .chev{margin-left:auto;color:var(--muted);font-size:18px}
    .wallet{margin-top:auto;background:#000;color:#fff;border:0;border-radius:22px;height:40px;padding:0 7px 0 18px;display:flex;align-items:center;justify-content:space-between;font-size:16px;font-weight:500;cursor:pointer}
    .wallet span{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#000;font-size:19px}
    .socials{border-top:1px solid var(--line);margin-top:24px;padding:18px 2px 0;display:grid;gap:20px}
    .socials a{display:flex;align-items:center;gap:13px;color:var(--link);font-size:16px}
    .socials em{margin-left:auto;font-style:normal}
    .main{min-width:0;padding:24px 40px 64px}
    .sidebar,.top-card,.hero-main,.status-panel,.metric,.card{min-width:0}
    .top-card{background:var(--card);border-radius:12px;min-height:86px;display:flex;align-items:center;justify-content:space-between;padding:20px 26px;margin-bottom:26px}
    .breadcrumb{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:16px}
    .breadcrumb strong{color:var(--ink);font-weight:500}
    .pill{display:inline-flex;align-items:center;gap:8px;border-radius:20px;background:#f0f1ff;color:var(--blue);padding:9px 14px;font-size:15px}
    .dot{width:8px;height:8px;border-radius:50%;background:var(--green)}
    .hero{display:grid;grid-template-columns:1.05fr .95fr;gap:24px;margin-bottom:24px}
    .hero-main{background:var(--card);border-radius:18px;padding:42px;min-height:390px;position:relative;overflow:hidden}
    .hero-main:before{content:"";position:absolute;right:-80px;top:-120px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,#dce4ff 0,#eef2ff 44%,transparent 72%)}
    .hero-main:after{content:"";position:absolute;right:78px;bottom:56px;width:74px;height:24px;background:var(--lavender);transform:skewY(-16deg)}
    .eyebrow{font-size:16px;color:var(--muted);margin-bottom:22px}
    h1{font-size:68px;line-height:.91;letter-spacing:-.045em;font-weight:500;max-width:670px;position:relative;z-index:1}
    .hero-main p{font-size:21px;line-height:1.38;color:#5e626d;max-width:560px;margin-top:24px;position:relative;z-index:1}
    .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px;position:relative;z-index:1}
    .btn{height:46px;border-radius:24px;padding:0 19px;border:1px solid #000;display:inline-flex;align-items:center;justify-content:center;gap:10px;font-weight:500;font-size:16px;background:#000;color:#fff;max-width:100%;white-space:nowrap}
    .btn.secondary{background:#fff;color:#000;border-color:#e2e3ea}
    .status-panel{background:var(--card);border-radius:18px;padding:28px;display:grid;gap:18px}
    .status-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .status-head h2{font-size:28px;font-weight:500}
    .loading-mark{width:54px;height:38px;position:relative}
    .loading-mark:before,.loading-mark:after{content:"";position:absolute;width:56px;height:14px;background:var(--lavender);transform:skewY(-16deg);left:0}
    .loading-mark:before{top:0}.loading-mark:after{bottom:0;left:14px;background:#9faee8}
    .proof-steps{display:grid;gap:10px}
    .step{display:grid;grid-template-columns:36px 1fr auto;align-items:center;gap:12px;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fbfbfe}
    .step b{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#000;color:#fff;font-size:14px;font-weight:500}
    .step span{font-size:17px}.step em{font-style:normal;color:var(--green);font-size:14px}
    .metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:24px}
    .metric{background:var(--card);border-radius:16px;padding:22px;min-height:154px}
    .metric span{display:block;color:var(--muted);font-size:15px;margin-bottom:18px}
    .metric strong{display:block;font-family:KHTekaMono,KHTeka,monospace;font-size:48px;font-weight:400;line-height:1;color:var(--blue)}
    .metric p{font-size:15px;color:#6f737d;margin-top:14px;line-height:1.28}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .card{background:var(--card);border-radius:16px;padding:24px}
    .card.wide{grid-column:1/-1}
    .card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
    .card h3{font-size:28px;font-weight:500}
    .card-head a{color:var(--link);font-size:15px}
    .detail{display:grid;grid-template-columns:180px minmax(0,1fr);gap:18px;padding:12px 0;border-top:1px solid var(--line)}
    .detail span{color:var(--muted);font-size:15px}
    .detail strong,.detail code,.card p,.tx-row strong{min-width:0;overflow-wrap:anywhere;font-size:16px;font-weight:400}
    .detail code{font-family:KHTekaMono,KHTeka,monospace;color:var(--blue);background:#f6f7ff;border-radius:8px;padding:8px 10px}
    .tx-list{display:grid;gap:8px}
    .tx-row{display:grid;grid-template-columns:1fr 190px 24px;gap:12px;align-items:center;background:#fbfbfe;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:16px}
    .tx-row strong{font-family:KHTekaMono,KHTeka,monospace;color:var(--link);font-weight:400;font-size:14px}
    .tx-row em{font-style:normal;color:var(--link)}
    footer{display:flex;justify-content:space-between;gap:18px;color:var(--muted);font-size:14px;margin-top:26px}
    footer a{color:var(--link)}
    @media(max-width:1100px){
      .app{display:block;max-width:100vw}.left-glow{display:none}.sidebar{position:relative;top:auto;width:auto;max-width:calc(100vw - 32px);height:auto;margin:16px;display:block;overflow:hidden}.nav{grid-template-columns:repeat(3,1fr);gap:14px}.wallet{width:100%;min-width:0;margin-top:24px}.socials{grid-template-columns:repeat(3,1fr)}
      .main{width:100%;max-width:100vw;padding:0 16px 48px}.hero,.grid{grid-template-columns:1fr}.hero,.grid,.metrics{width:100%;max-width:100%}.metrics{grid-template-columns:repeat(2,1fr)}
    }
    @media(max-width:640px){
      .sidebar{margin:12px;padding:18px 14px;max-width:calc(100vw - 24px)}
      .brand{margin-bottom:16px}.brand img{width:172px}
      .nav{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 10px;padding:0 4px}.nav a{gap:9px;font-size:16px}.nav svg{width:18px;height:18px}
      .wallet{height:38px;margin-top:16px}.wallet span{flex:0 0 32px;width:32px;height:32px}
      .socials{grid-template-columns:1fr;gap:12px;margin-top:14px;padding-top:14px}
      .main{padding:0 12px 42px}.metrics{grid-template-columns:1fr}.top-card,.hero-main,.status-panel,.card,.metric{max-width:calc(100vw - 24px)}.top-card{display:grid;gap:12px;overflow:hidden;min-height:0;padding:18px}.breadcrumb{flex-wrap:wrap}.hero-main{width:100%;overflow:hidden;padding:24px;min-height:0}h1{width:100%;max-width:100%;font-size:32px;letter-spacing:-.035em;white-space:normal;overflow-wrap:anywhere;word-break:break-word}.hero-main p{width:100%;max-width:100%;font-size:17px;overflow-wrap:anywhere;word-break:break-word}.actions{display:grid}.btn{width:100%;white-space:normal;text-align:center}.detail,.tx-row{grid-template-columns:1fr}.status-head{display:grid}footer{display:grid}
    }
  </style>
</head>
<body>
  <div class="left-glow"></div>
  <div class="app">
    <aside class="sidebar">
      <a class="brand" href="#overview" aria-label="LumenSure overview">
        <img src="./lumensure-logo.svg" alt="LumenSure" width="196" height="41" />
      </a>
      <nav class="nav" aria-label="Primary">
        <a href="#overview">${navIcon("overview")}<span>Overview</span></a>
        <a href="#policy">${navIcon("policy")}<span>Policy</span></a>
        <a href="#proof">${navIcon("proof")}<span>Claim proof</span></a>
        <a href="#oracle">${navIcon("oracle")}<span>Oracle</span></a>
        <a href="#reserve">${navIcon("reserve")}<span>Reserve</span></a>
        <a href="#evidence">${navIcon("evidence")}<span>Evidence</span></a>
      </nav>
      <a class="wallet" href="https://stellar.expert/explorer/testnet/contract/${CONFIG.insuranceContract}" target="_blank" rel="noreferrer">View contract <span>-></span></a>
      <div class="socials">
        <a href="./onchain-snapshot.json">On-chain snapshot<em>-></em></a>
        <a href="${explorerTx(CONFIG.tx.claim)}">Claim transaction<em>-></em></a>
        <a href="https://stellar.expert/explorer/testnet/contract/${CONFIG.insuranceContract}" target="_blank" rel="noreferrer">Contract explorer<em>-></em></a>
      </div>
    </aside>

    <main class="main" id="overview">
      <section class="top-card">
        <div class="breadcrumb"><span>LumenSure</span><strong>Verifiable insurance</strong><span>|</span><span>${escapeHtml(CONFIG.networkLabel)}</span></div>
        <div class="pill"><i class="dot"></i>${escapeHtml(status)}</div>
      </section>

      <section class="hero">
        <article class="hero-main">
          <div class="eyebrow">On-chain insurance quest</div>
          <h1>Proof-backed payout,<br />live on Stellar.</h1>
          <p>Policy #${CONFIG.policyId} was verified with the active oracle key, nullifier replay protection, and a public payout transaction.</p>
          <div class="actions">
            <a class="btn" href="${explorerTx(CONFIG.tx.claim)}" target="_blank" rel="noreferrer">View claim transaction -></a>
            <a class="btn secondary" href="./onchain-snapshot.json">Open snapshot</a>
          </div>
        </article>
        <article class="status-panel">
          <div class="status-head">
            <h2>Settlement route</h2>
            <span class="loading-mark" aria-hidden="true"></span>
          </div>
          <div class="proof-steps">
            <div class="step"><b>1</b><span>Oracle event committed</span><em>done</em></div>
            <div class="step"><b>2</b><span>Proof blob submitted</span><em>done</em></div>
            <div class="step"><b>3</b><span>UltraHonk verified</span><em>done</em></div>
            <div class="step"><b>4</b><span>Nullifier consumed</span><em>done</em></div>
            <div class="step"><b>5</b><span>Payout executed</span><em>done</em></div>
          </div>
        </article>
      </section>

      <section class="metrics" aria-label="Metrics">
        ${metric("Policy paid", paid ? "1" : "0", "Successful public settlement")}
        ${metric("Nullifier used", onchain.nullifierUsed ? "1" : "0", "Replay protection consumed")}
        ${metric("Payout", onchain.product?.payout, "Native SAC units paid")}
        ${metric("Balance", onchain.insuranceBalance, "Remaining contract reserve")}
      </section>

      <section class="grid" id="policy">
        <article class="card">
          <div class="card-head"><h3>Policy state</h3><a href="${explorerTx(CONFIG.tx.claim)}" target="_blank" rel="noreferrer">Explorer -></a></div>
          ${detail("Product id", CONFIG.productId)}
          ${detail("Policy id", CONFIG.policyId)}
          ${detail("Holder", onchain.policy?.holder, true)}
          ${detail("Premium", onchain.product?.premium)}
          ${detail("Payout", onchain.product?.payout)}
          ${detail("Threshold", onchain.product?.threshold)}
          ${detail("Active", onchain.policy?.active)}
          ${detail("Paid", onchain.policy?.paid)}
        </article>

        <article class="card" id="oracle">
          <div class="card-head"><h3>Oracle route</h3><a href="${explorerTx(CONFIG.tx.setOracleKey)}" target="_blank" rel="noreferrer">Registry -></a></div>
          ${detail("Oracle key X", onchain.oracleKeyX, true)}
          ${detail("Oracle key Y", onchain.oracleKeyY, true)}
          ${detail("Commitment", onchain.eventCommitment, true)}
          ${detail("Status", "Committed")}
        </article>

        <article class="card" id="proof">
          <div class="card-head"><h3>Verifier binding</h3><a href="https://stellar.expert/explorer/testnet/contract/${CONFIG.insuranceContract}" target="_blank" rel="noreferrer">Contract -></a></div>
          ${detail("Contract", CONFIG.insuranceContract, true)}
          ${detail("WASM hash", CONFIG.wasmHash, true)}
          ${detail("Proof source", "artifacts/proof_blob.bin submitted on-chain")}
          ${detail("Nullifier", CONFIG.nullifier, true)}
          ${detail("Nullifier status", onchain.nullifierUsed ? "Used / replay blocked" : "Unused")}
        </article>

        <article class="card" id="reserve">
          <div class="card-head"><h3>Reserve</h3><a href="${explorerTx(CONFIG.tx.reserveTransfer)}" target="_blank" rel="noreferrer">Transfer -></a></div>
          ${detail("Token contract", CONFIG.nativeTokenContract, true)}
          ${detail("Insurance balance", onchain.insuranceBalance)}
          ${detail("Deployer balance", onchain.deployerBalance)}
          ${detail("Reserve tx", short(CONFIG.tx.reserveTransfer, 14, 12))}
          ${detail("Payout tx", short(CONFIG.tx.claim, 14, 12))}
        </article>

        <article class="card wide" id="evidence">
          <div class="card-head"><h3>Explorer evidence</h3><a href="https://stellar.expert/explorer/testnet/contract/${CONFIG.insuranceContract}" target="_blank" rel="noreferrer">Open contract -></a></div>
          <div class="tx-list">
            ${txRow("Upload WASM", CONFIG.tx.upload)}
            ${txRow("Deploy contract", CONFIG.tx.deploy)}
            ${txRow("Initialize pool", CONFIG.tx.init)}
            ${txRow("Set oracle key", CONFIG.tx.setOracleKey)}
            ${txRow("Create product", CONFIG.tx.createProduct)}
            ${txRow("Buy policy #1", CONFIG.tx.buyPolicy1)}
            ${txRow("Publish event", CONFIG.tx.publishEvent)}
            ${txRow("Reserve transfer", CONFIG.tx.reserveTransfer)}
            ${txRow("Claim payout", CONFIG.tx.claim)}
          </div>
        </article>
      </section>

      <footer>
        <span>LumenSure | Private claims, proven payouts on Stellar.</span>
        <a href="./onchain-snapshot.json">onchain-snapshot.json</a>
      </footer>
    </main>
  </div>
</body>
</html>
`,
);

console.log("wrote web/dist/index.html from Stellar testnet on-chain reads");
console.log("wrote web/dist/onchain-snapshot.json");
