#[cfg(test)]
mod integration_tests {
    use std::process::{Command, Stdio};
    use std::time::Duration;
    use testcontainers::{ContainerAsync, GenericImage};
    use tokio::time::sleep;
    use reqwest::Client;
    use stellar_xdr::curr::*;
    use ed25519_dalek::SigningKey;
    use rand::rngs::OsRng;
    use base64::{engine::general_purpose::STANDARD, Engine};

    const ROOT_SECRET: &str = "SC5O7VZUXDJFLHH2VQ4TOAEZHZ2BI3HKF2WVFIKOOHWLOFJV2QFWLOHR";
    const NETWORK_PASSPHRASE: &str = "Standalone Network ; March 2026";

    #[tokio::test]
    async fn test_fee_bump_integration() {
        // Start Stellar Quickstart container
        let quickstart_image = GenericImage::new("stellar/quickstart", "latest")
            .with_env_var("STELLAR_CORE_COMMAND", "standalone")
            .with_exposed_port(8000);

        let quickstart_container = quickstart_image.start().await;

        let horizon_port = quickstart_container.get_host_port_ipv4(8000);
        let horizon_url = format!("http://localhost:{}", horizon_port);

        // Wait for Horizon to be ready
        let client = Client::new();
        for _ in 0..60 {
            if let Ok(resp) = client.get(&format!("{}/health", horizon_url)).send().await {
                if resp.status().is_success() {
                    break;
                }
            }
            sleep(Duration::from_secs(2)).await;
        }

        // Root keypair
        let root_strkey = stellar_strkey::Strkey::from_string(ROOT_SECRET).unwrap();
        let root_secret_bytes = if let stellar_strkey::Strkey::SecretKeyEd25519(u) = root_strkey { u.0 } else { panic!() };
        let root_kp = SigningKey::from_bytes(&root_secret_bytes);

        // Generate fee payer keypair
        let fee_payer_kp = SigningKey::generate(&mut OsRng);
        let fee_payer_secret = stellar_strkey::Strkey::SecretKeyEd25519(Uint256(fee_payer_kp.to_bytes())).to_string();
        let fee_payer_pub_bytes = fee_payer_kp.verifying_key().to_bytes();

        // Fund fee payer account from root
        fund_account(&client, &horizon_url, &root_kp, &fee_payer_pub_bytes, 10000000000).await; // 100 XLM

        // Generate test account
        let test_account_kp = SigningKey::generate(&mut OsRng);
        let test_account_pub_bytes = test_account_kp.verifying_key().to_bytes();

        // Fund test account
        fund_account(&client, &horizon_url, &root_kp, &test_account_pub_bytes, 10000000000).await; // 100 XLM

        // Build a transaction: payment from test_account to a new account
        let dest_kp = SigningKey::generate(&mut OsRng);
        let dest_pub_bytes = dest_kp.verifying_key().to_bytes();

        let test_account_pub_str = stellar_strkey::Strkey::encode_ed25519_public_key(&test_account_pub_bytes).unwrap();
        let account_info: serde_json::Value = client
            .get(&format!("{}/accounts/{}", horizon_url, test_account_pub_str))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();

        let sequence = account_info["sequence"].as_str().unwrap().parse::<i64>().unwrap();

        let xdr = build_payment_xdr(&test_account_kp, &dest_pub_bytes, 10000000, sequence, NETWORK_PASSPHRASE);

        // Start the fluid-server
        let mut server_process = Command::new("cargo")
            .args(&["run"])
            .env("STELLAR_HORIZON_URLS", &horizon_url)
            .env("FLUID_FEE_PAYER_SECRET", &fee_payer_secret)
            .env("FLUID_NETWORK_PASSPHRASE", NETWORK_PASSPHRASE)
            .env("FLUID_BASE_FEE", "100")
            .env("FLUID_FEE_MULTIPLIER", "2.0")
            .env("FLUID_PORT", "3001")
            .stdout(Stdio::piped())
            .spawn()
            .expect("Failed to start server");

        // Wait for server to start
        sleep(Duration::from_secs(5)).await;

        // Send transaction to server
        let server_url = "http://localhost:3001/fee-bump";
        let payload = serde_json::json!({
            "xdr": xdr
        });

        let response = client
            .post(server_url)
            .json(&payload)
            .send()
            .await
            .expect("Failed to send transaction");

        assert!(response.status().is_success());

        let result: serde_json::Value = response.json().await.unwrap();
        let fee_bump_xdr = result["fee_bump_xdr"].as_str().unwrap();

        // Get transaction hash from fee_bump_xdr
        let envelope_bytes = STANDARD.decode(fee_bump_xdr).unwrap();
        let envelope = TransactionEnvelope::from_xdr(&envelope_bytes, Limits::none()).unwrap();
        let tx_hash = envelope.hash(NETWORK_PASSPHRASE.as_bytes()).unwrap();

        // Wait for transaction to be confirmed
        let mut confirmed = false;
        for _ in 0..30 {
            if let Ok(resp) = client.get(&format!("{}/transactions/{}", horizon_url, hex::encode(tx_hash))).send().await {
                if resp.status().is_success() {
                    confirmed = true;
                    break;
                }
            }
            sleep(Duration::from_secs(2)).await;
        }

        assert!(confirmed, "Transaction not confirmed");

        // Cleanup
        server_process.kill().unwrap();
        quickstart_container.stop();
    }

    async fn fund_account(client: &Client, horizon_url: &str, source: &SigningKey, dest: &[u8; 32], amount: i64) {
        let source_pub_str = stellar_strkey::Strkey::encode_ed25519_public_key(&source.verifying_key().to_bytes()).unwrap();
        let account_info: serde_json::Value = client
            .get(&format!("{}/accounts/{}", horizon_url, source_pub_str))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();

        let sequence = account_info["sequence"].as_str().unwrap().parse::<i64>().unwrap();

        let xdr = build_create_account_xdr(source, dest, amount, sequence, NETWORK_PASSPHRASE);

        let submit_resp: serde_json::Value = client
            .post(&format!("{}/transactions", horizon_url))
            .json(&serde_json::json!({"tx": xdr}))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();

        assert!(submit_resp["successful"].as_bool().unwrap());
    }

    fn build_payment_xdr(source: &SigningKey, dest: &[u8; 32], amount: i64, sequence: i64, network: &str) -> String {
        let source_pub_bytes = source.verifying_key().to_bytes();
        let source_pub = PublicKey::PublicKeyTypeEd25519(Uint256(source_pub_bytes));
        let muxed_source = MuxedAccount::Ed25519(Uint256(source_pub_bytes));

        let muxed_dest = MuxedAccount::Ed25519(Uint256(*dest));

        let asset = Asset::Native;

        let tx = Transaction {
            source_account: muxed_source,
            fee: 100,
            seq_num: SequenceNumber(sequence),
            cond: Preconditions::None,
            memo: Memo::None,
            operations: vec![Operation {
                source_account: None,
                body: OperationBody::Payment(PaymentOp {
                    destination: muxed_dest,
                    asset,
                    amount: amount,
                }),
            }],
            ext: TransactionExt::V0,
        };

        let envelope = TransactionEnvelope::Tx(TransactionV1Envelope {
            tx,
            signatures: vec![],
        });

        let tx_hash = envelope.hash(network.as_bytes()).unwrap();

        let signature = source.sign(&tx_hash);

        let hint = &source_pub_bytes[28..32];
        let mut hint_arr = [0u8; 4];
        hint_arr.copy_from_slice(hint);
        let decorated_sig = DecoratedSignature {
            hint: SignatureHint(hint_arr),
            signature: Signature(signature.to_bytes().to_vec()),
        };

        let signed_envelope = TransactionEnvelope::Tx(TransactionV1Envelope {
            tx,
            signatures: vec![decorated_sig],
        });

        STANDARD.encode(signed_envelope.to_xdr(Limits::none()).unwrap())
    }

    fn build_create_account_xdr(source: &SigningKey, dest: &[u8; 32], amount: i64, sequence: i64, network: &str) -> String {
        let source_pub_bytes = source.verifying_key().to_bytes();
        let muxed_source = MuxedAccount::Ed25519(Uint256(source_pub_bytes));

        let muxed_dest = MuxedAccount::Ed25519(Uint256(*dest));

        let tx = Transaction {
            source_account: muxed_source,
            fee: 100,
            seq_num: SequenceNumber(sequence),
            cond: Preconditions::None,
            memo: Memo::None,
            operations: vec![Operation {
                source_account: None,
                body: OperationBody::CreateAccount(CreateAccountOp {
                    destination: muxed_dest,
                    starting_balance: amount,
                }),
            }],
            ext: TransactionExt::V0,
        };

        let envelope = TransactionEnvelope::Tx(TransactionV1Envelope {
            tx,
            signatures: vec![],
        });

        let tx_hash = envelope.hash(network.as_bytes()).unwrap();

        let signature = source.sign(&tx_hash);

        let hint = &source_pub_bytes[28..32];
        let mut hint_arr = [0u8; 4];
        hint_arr.copy_from_slice(hint);
        let decorated_sig = DecoratedSignature {
            hint: SignatureHint(hint_arr),
            signature: Signature(signature.to_bytes().to_vec()),
        };

        let signed_envelope = TransactionEnvelope::Tx(TransactionV1Envelope {
            tx,
            signatures: vec![decorated_sig],
        });

        STANDARD.encode(signed_envelope.to_xdr(Limits::none()).unwrap())
    }
}