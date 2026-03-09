"""
Deploy TalentLens contract to Polygon Mumbai testnet.

Requirements:
  pip install web3 py-solc-x

Usage:
  PRIVATE_KEY=0x... POLYGON_RPC=https://rpc-mumbai.maticvigil.com python deploy.py
"""
import os
import json
from web3 import Web3


def compile_contract():
    try:
        from solcx import compile_standard, install_solc
        install_solc("0.8.19")

        with open("TalentLensHiring.sol") as f:
            source = f.read()

        compiled = compile_standard({
            "language": "Solidity",
            "sources": {"TalentLensHiring.sol": {"content": source}},
            "settings": {
                "outputSelection": {"*": {"*": ["abi", "metadata", "evm.bytecode", "evm.sourceMap"]}}
            },
        }, solc_version="0.8.19")

        return compiled
    except ImportError:
        print("Install py-solc-x: pip install py-solc-x")
        raise


def deploy():
    rpc_url = os.getenv("POLYGON_RPC", "https://rpc-mumbai.maticvigil.com")
    private_key = os.getenv("PRIVATE_KEY")
    if not private_key:
        print("Set PRIVATE_KEY env variable")
        return

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        print(f"Cannot connect to {rpc_url}")
        return

    compiled = compile_contract()
    contract_data = compiled["contracts"]["TalentLensHiring.sol"]["TalentLensHiring"]
    abi = contract_data["abi"]
    bytecode = contract_data["evm"]["bytecode"]["object"]

    account = w3.eth.account.from_key(private_key)
    print(f"Deploying from: {account.address}")
    print(f"Balance: {w3.from_wei(w3.eth.get_balance(account.address), 'ether')} MATIC")

    contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx = contract.constructor().build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 1000000,
        "gasPrice": w3.eth.gas_price,
    })

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    print(f"Tx: {tx_hash.hex()}")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"✅ Contract deployed at: {receipt.contractAddress}")
    print(f"Block: {receipt.blockNumber}")

    # Save deployment info
    with open("deployment.json", "w") as f:
        json.dump({
            "address": receipt.contractAddress,
            "abi": abi,
            "tx_hash": tx_hash.hex(),
            "block": receipt.blockNumber,
            "network": "polygon_mumbai",
        }, f, indent=2)

    print("Saved to deployment.json")
    print(f"\nAdd to .env:")
    print(f"CONTRACT_ADDRESS={receipt.contractAddress}")


if __name__ == "__main__":
    deploy()
