## Introduction
mUSD is a **Mantle-native, mETH-backed stablecoin** designed to be:

- **Overcollateralized** (lock mETH → mint mUSD)
- **Composable** (used in DeFi and RWA markets)
- **Extensible** (supports leverage via Super-Stake)
- **Compliance-aware** (RWA pools gated by ZK proofs)

The protocol consists of:

- A **core mUSD contract** for minting and redemption
- A **Super-Stake contract** for recursive leveraged staking
- **Compliant RWA liquidity pools** gated by RISC Zero proofs
- An **off-chain compliance + proof generation flow**
- A user-facing frontend and backend middleware

## Main Components

### Smart Contracts
This layer contains all **on-chain financial logic**.

### Responsibilities

- Lock mETH and mint mUSD
- Burn mUSD and unlock mETH
- Automate leveraged positions via Super-Stake
- Enforce compliance at RWA pools (via verifier)

#### 1. mUSD Core Contract

**Purpose:**

Manages collateralization and stablecoin issuance.

**Key rules:**

- Only **mETH** is accepted as collateral
- Users mint mUSD up to a fixed LTV
- Burning mUSD unlocks the user’s mETH

### Flow: Mint & Redeem
```mermaid
sequenceDiagram
    actor User
    participant mETH
    participant mUSD

    User->>mETH: Approve mUSD
    mUSD->>mETH: transferFrom(User)
    mUSD->>mUSD: Lock mETH
    mUSD->>User: Mint mUSD

    User->>mUSD: Burn mUSD
    mUSD->>mUSD: Unlock mETH
    mUSD->>User: Return mETH
```

#### 2. Super-Stake Contract

**Purpose:**

Allows users to **leverage** their staking position through controlled recursion automatically.

**What it does:**

- Accepts mETH or mUSD
- Mints mUSD against mETH
- Swaps mUSD → mETH
- Repeats the process a bounded number of times

This maximizes staking exposure **without manual looping**.

#### Flow: Recursive Leverage

```mermaid
sequenceDiagram
    actor User
    participant SuperStake
    participant mUSD
    participant DEX

    User->>SuperStake: Deposit mETH or mUSD

    loop Recursive leverage (bounded)
        SuperStake->>mUSD: Lock mETH & mint mUSD
        mUSD->>SuperStake: mUSD
        SuperStake->>DEX: Swap mUSD → mETH
        DEX->>SuperStake: mETH
    end

    SuperStake-->>User: Leveraged position created
```

#### 3. Compliant RWA Pools (On-chain)

**Purpose:**

Create **regulated liquidity pools** such as:

- mUSD ↔ Gold
- mUSD ↔ Money Market
- mUSD ↔ Real Estate

**Key idea:**

The pool itself is on-chain and simple, but **swaps are gated** by a zero-knowledge proof.

### Flow: Proof-Gated Swap

```mermaid
sequenceDiagram
    actor User
    participant RWAPool
    participant Verifier

    User->>RWAPool: Swap request + proof
    RWAPool->>Verifier: Verify proof
    Verifier-->>RWAPool: Proof valid
    RWAPool-->>User: Execute swap
```


## Proofer
The **Proofer** is an **off-chain ZK proving system** built using **RISC Zero**.

### Responsibilities

- Encode compliance logic (KYC, jurisdiction, limits, etc.)
- Generate a **zero-knowledge proof**
- Ensure **no personal data** is exposed on-chain

### What the proof asserts (examples)

- User passed KYC
- User is allowed to trade this RWA
- User has not exceeded allowed limits

### Proofer Conceptual Flow
```mermaid
flowchart LR
    UserData[User Data]
    Rules[Compliance Rules]
    Proof[ZK Proof]

    UserData --> Rules
    Rules --> Proof
```


## Backend Middleware Service

### To Send Proofer Data (Proofer Inputs)
This service acts as the bridge between the frontend and the proofer.
### Responsibilities

- Receive swap intent from frontend
- Fetch / validate compliance inputs
- Call the proofer
- Return a proof usable on-chain

This keeps:

- Frontend simple
- Prover isolated
- Compliance logic upgradeable
  
### Backend Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Backend
    participant Proofer

    User->>Frontend: Request RWA swap
    Frontend->>Backend: Send user context
    Backend->>Proofer: Provide inputs
    Proofer-->>Backend: ZK proof
    Backend-->>Frontend: Return proof
```

## Frontend
The frontend is the **single user entry point**.

### Responsibilities

- Wallet connection
- mUSD mint / burn UI
- Super-Stake position creation
- RWA swaps with compliance handling
- Clear UX around leverage and compliance

### Frontend Interaction Overview

```mermaid
flowchart LR
    User --> Frontend
    Frontend --> mUSD
    Frontend --> SuperStake
    Frontend --> Backend
    Backend --> Proofer
```


### Overall Architecture

```mermaid
 sequenceDiagram
    actor User
    participant mUSD as mUSD Contract
    participant mETH as mETH Token
    participant SuperStake as Super-Stake Contract
    participant DEX as DEX Router
    participant Compliance as Compliance API (Off-chain)
    participant Verifier as RISC Zero Verifier
    participant RWAPool as RWA Pool

    %% ========= BASIC mUSD MINTING =========
    Note over User,mUSD: Basic Flow: Mint mUSD
    User->>mETH: Approve mUSD
    mUSD->>mETH: transferFrom(User, mUSD)
    mUSD->>mUSD: Lock mETH as collateral
    mUSD->>User: Mint and transfer mUSD

    Note over User,mUSD: Basic Flow: Repay and Unlock
    User->>mUSD: Burn mUSD
    mUSD->>mUSD: Unlock mETH collateral
    mUSD->>User: Return mETH

    %% ========= SUPER STAKE LEVERAGE =========
    Note over User,DEX: Super-Stake: Leveraged Position
    User->>SuperStake: Deposit mETH or mUSD

    loop Recursive Leverage (bounded)
        SuperStake->>mETH: Approve mUSD
        SuperStake->>mUSD: Lock mETH and mint mUSD
        mUSD->>SuperStake: Return minted mUSD
        SuperStake->>DEX: Swap mUSD to mETH
        DEX->>SuperStake: Return mETH
        SuperStake->>SuperStake: Increase position
    end

    SuperStake-->>User: Leveraged staking position created

    %% ========= COMPLIANT RWA SWAP =========
    Note over User,RWAPool: Compliant RWA Pool Swap
    User->>Compliance: Request swap (off-chain)
    Compliance->>Compliance: Check compliance rules
    Compliance->>Compliance: Generate ZK proof
    Compliance->>User: Return proof

    User->>RWAPool: Submit swap with proof
    RWAPool->>Verifier: Verify proof
    Verifier-->>RWAPool: Proof valid
    RWAPool-->>User: Execute swap (mUSD ↔ RWA)

```
