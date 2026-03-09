"""
TalentLens AI - Blockchain Service
Logs hiring decisions to Polygon Mumbai testnet.
Falls back to simulated hash if no wallet configured.
"""
import hashlib
import time
import secrets
from typing import Dict, Any
from app.config import settings


async def log_decision(
    resume_hash: str,
    score: float,
    fairness_score: float,
    decision: str,
) -> Dict[str, Any]:
    """
    Log hiring decision to blockchain.
    If no private key configured, returns a simulated deterministic hash for demo.
    """
    if not settings.PRIVATE_KEY or not settings.CONTRACT_ADDRESS:
        return _simulate_blockchain_tx(resume_hash, score, fairness_score, decision)

    try:
        from web3 import Web3
        w3 = Web3(Web3.HTTPProvider(settings.POLYGON_RPC_URL))

        if not w3.is_connected():
            return _simulate_blockchain_tx(resume_hash, score, fairness_score, decision)

        # Load contract ABI (minimal)
        contract_abi = [
            {
                "inputs": [
                    {"internalType": "bytes32", "name": "resumeHash", "type": "bytes32"},
                    {"internalType": "uint256", "name": "score", "type": "uint256"},
                    {"internalType": "uint256", "name": "fairnessScore", "type": "uint256"},
                    {"internalType": "string", "name": "decision", "type": "string"},
                ],
                "name": "logHiringDecision",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function",
            }
        ]

        contract = w3.eth.contract(address=settings.CONTRACT_ADDRESS, abi=contract_abi)
        account = w3.eth.account.from_key(settings.PRIVATE_KEY)
        resume_bytes32 = bytes.fromhex(resume_hash[:64].ljust(64, '0'))

        tx = contract.functions.logHiringDecision(
            resume_bytes32,
            int(score),
            int(fairness_score),
            decision,
        ).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 200000,
            "gasPrice": w3.eth.gas_price,
        })

        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

        return {
            "transaction_hash": tx_hash.hex(),
            "block_number": receipt.blockNumber,
            "network": "polygon_mumbai",
            "status": "confirmed",
        }

    except Exception as e:
        print(f"Blockchain error: {e}")
        return _simulate_blockchain_tx(resume_hash, score, fairness_score, decision)


def _simulate_blockchain_tx(resume_hash: str, score: float, fairness: float, decision: str) -> Dict[str, Any]:
    """
    Generates a deterministic simulated transaction hash for demo purposes.
    Uses same data so same inputs always produce same hash.
    """
    data = f"{resume_hash}{score}{fairness}{decision}{int(time.time() // 3600)}"
    sim_hash = "0x" + hashlib.sha256(data.encode()).hexdigest()
    random_block = 45000000 + int(hashlib.md5(data.encode()).hexdigest()[:6], 16) % 1000000

    return {
        "transaction_hash": sim_hash,
        "block_number": random_block,
        "network": "polygon_mumbai_simulated",
        "status": "simulated",
    }
