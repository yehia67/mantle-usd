use risc0_zkvm::guest::env;

fn main() {
    // read the input
    let is_compliant: bool = env::read();

    // write public output to the journal
    env::commit(&is_compliant);
}
