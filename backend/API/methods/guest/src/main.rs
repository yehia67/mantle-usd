use risc0_zkvm::guest::env;

fn main() {
    // read the input
    let is_compliant: u32 = env::read();

    let journal_bytes: Vec<u8> = if is_compliant == 0 {
        vec![0u8]
    } else {
        vec![1u8]
    };

    // write public output to the journal
    env::commit(&journal_bytes);
}
