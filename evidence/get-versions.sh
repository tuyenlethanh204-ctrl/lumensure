#!/bin/bash
export PATH="$HOME/.cargo/bin:$HOME/.nargo/bin:$HOME/.local/bin:$PATH"
cd /mnt/d/dorahack/stellar/zkinsure
echo "Node version:" > evidence/tool-versions.txt
node -v >> evidence/tool-versions.txt
echo "Cargo version:" >> evidence/tool-versions.txt
cargo -V >> evidence/tool-versions.txt
echo "Nargo version:" >> evidence/tool-versions.txt
nargo --version >> evidence/tool-versions.txt
echo "Stellar CLI version:" >> evidence/tool-versions.txt
stellar --version >> evidence/tool-versions.txt
npm install
