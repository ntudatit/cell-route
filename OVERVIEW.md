# CellRoute — Functional Overview and Reviewer Guide

## 1. What is CellRoute?

**CellRoute** is a learning and experimentation application built around the Nervos CKB Cell Model.

The project is designed to make CKB concepts observable through complete application flows rather than isolated scripts.

CellRoute currently focuses on:

- wallet-connected CKB interactions
- Cell creation and consumption
- transaction construction and validation
- custom Lock Script experiments
- sUDT/xUDT token operations
- local Devnet execution
- script runtime and debugging
- transaction evidence collection for testing and review

The goal is to provide a small but realistic environment where a developer can answer questions such as:

- What Cells are consumed by a transaction?
- What Cells are created?
- Which scripts validate the transaction?
- What state is expected to remain unchanged?
- What state is allowed to change?
- Why should an invalid transaction be rejected?
- How can the script execution be reproduced and debugged?

CellRoute is therefore not only a UI for sending CKB transactions.

It is also a **CKB development laboratory** for understanding transaction invariants, script behavior, and Cell-state transitions.

---

## 2. High-Level Architecture

```text
                         ┌──────────────────────────┐
                         │        CellRoute UI      │
                         │                          │
                         │ Wallet / Token / Labs    │
                         └────────────┬─────────────┘
                                      │
                                      │ User action
                                      ▼
                         ┌──────────────────────────┐
                         │ Transaction Builder      │
                         │                          │
                         │ Inputs                   │
                         │ Outputs                  │
                         │ CellDeps                 │
                         │ Witnesses                │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │ Validation Layer         │
                         │                          │
                         │ Amount checks            │
                         │ Capacity checks          │
                         │ Script constraints       │
                         │ Authorization checks     │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │ Wallet / Signer          │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │ CKB Devnet Node          │
                         │                          │
                         │ CKB VM executes scripts  │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │ Transaction / Cell State │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │ Evidence / Debug Layer   │
                         │                          │
                         │ TX hash                  │
                         │ Inputs / Outputs         │
                         │ Script result            │
                         │ Debug information        │
                         └──────────────────────────┘
```

---

## 3. Main Functional Modules

### 3.1 Wallet / Account Module

#### Purpose

The wallet module provides the identity used to create, sign, and submit transactions.

#### Responsibilities

- connect or derive the current CKB account
- expose the user's Lock Script
- query Cells owned by the account
- display available CKB capacity
- sign transactions
- submit signed transactions

#### Expected behavior

After connecting an account:

```text
User
 |
 +-- CKB Address
 |
 +-- Lock Script
 |
 +-- Live Cells
 |
 +-- CKB Balance
```

Only Cells controlled by the user's Lock Script should normally be available for spending.

#### Reviewer focus

A reviewer can verify that:

- the correct address maps to the expected Lock Script
- inputs belong to the signing account
- the resulting transaction contains valid witnesses
- Cells cannot be spent without satisfying the Lock Script

---

### 3.2 Cell Explorer Module

#### Purpose

The Cell Explorer makes the CKB Cell Model visible to the user.

Instead of displaying only balances, CellRoute exposes actual Cells.

A Cell can be represented as:

```text
Cell
├── capacity
├── lock
├── type
└── data
```

#### Example

```json
{
  "capacity": "150 CKB",
  "lock": {
    "codeHash": "...",
    "hashType": "type",
    "args": "0x..."
  },
  "type": null,
  "data": "0x..."
}
```

#### Expected behavior

The module should show the transition between:

```text
Previous Live Cells
        |
        v
Transaction Inputs
        |
        v
CKB Validation
        |
        v
Transaction Outputs
        |
        v
New Live Cells
```

Once a Cell is consumed as an input, it must never become live again.

---

### 3.3 CKB Transfer Module

#### Purpose

Demonstrates the standard Cell consumption and creation process.

#### Flow

```text
Select funding Cells
       |
       v
Calculate required capacity
       |
       v
Create receiver output
       |
       v
Create change output
       |
       v
Sign transaction
       |
       v
Submit transaction
       |
       v
Wait for confirmation
```

#### Example

Before:

```text
Input Cell
1000 CKB
```

Transaction:

```text
Input
1000 CKB

Outputs
├── Receiver: 300 CKB
└── Change:   699.xxx CKB

Fee
└── remaining capacity difference
```

#### Expected behavior

The total output capacity cannot exceed the total input capacity.

Conceptually:

```text
Σ Input Capacity >= Σ Output Capacity
```

The difference represents the transaction fee.

---

### 3.4 Data Cell Module

#### Purpose

Demonstrates storing application data directly inside a CKB Cell.

#### Flow

```text
User enters message
       |
       v
Encode text to bytes / hex
       |
       v
Create Cell output
       |
       v
Store encoded bytes in Cell data
       |
       v
Submit transaction
       |
       v
Query resulting Cell
       |
       v
Decode data
```

#### Example

```text
Input:

Hello CKB

Encoded:

0x48656c6c6f20434b42
```

The resulting Cell contains:

```text
data = 0x48656c6c6f20434b42
```

#### Expected behavior

The decoded value retrieved from the live Cell should match the original value.

```text
decode(encode(message)) == message
```

---

### 3.5 Simple Lock Lab

#### Purpose

The Simple Lock Lab demonstrates custom authorization using a Lock Script.

A secret value is hashed:

```text
secret
   |
   v
hash(secret)
   |
   v
Lock Script args
```

The Cell can only be spent when a valid preimage is provided.

#### Lock flow

```text
Preimage
   |
   v
Hash
   |
   v
Create Lock Script
   |
   v
Create locked Cell
```

#### Unlock flow

```text
Locked Cell
    |
    v
Provide preimage
    |
    v
CKB VM executes Lock Script
    |
    v
hash(provided preimage)
    |
    +------ matches script args ------> ACCEPT
    |
    └------ does not match -----------> REJECT
```

#### Expected behavior

Valid case:

```text
hash(preimage) == expected_hash
```

Invalid case:

```text
hash(preimage) != expected_hash
```

must fail script validation.

---

### 3.6 sUDT Token Module

#### Purpose

The sUDT module demonstrates fungible assets represented using CKB Cells.

Token state is stored inside Cell data.

Example:

```text
Token Cell
├── capacity
├── lock
├── sUDT Type Script
└── data = token amount
```

The current implementation encodes the token amount using:

```text
uint128 little-endian
```

#### 3.6.1 Mint

##### Flow

```text
Issuer Cell / Owner Lock
        |
        v
Build token output
        |
        v
Encode amount
        |
        v
Attach sUDT Type Script
        |
        v
Validate issuer authority
        |
        v
Submit
```

Example:

```text
Mint 1000 tokens

Output Token Cell

data =
uint128_le(1000)
```

##### Expected behavior

Only the expected issuer/owner condition should allow creation of additional supply.

Unauthorized mint attempts must fail.

#### 3.6.2 Transfer

##### Flow

```text
Input Token Cells
        |
        v
Decode token amounts
        |
        v
Calculate total input amount
        |
        v
Create receiver token Cell
        |
        v
Create optional change token Cell
        |
        v
Submit transaction
```

Example:

```text
Input

1000 tokens

Outputs

Receiver: 400
Change:   600
```

Expected:

```text
1000 = 400 + 600
```

Token transfer must not create new supply.

#### 3.6.3 Burn

##### Flow

```text
Input Token Cells
        |
        v
Consume token Cells
        |
        v
Create outputs with smaller total amount
        |
        v
Difference becomes burned supply
```

Example:

```text
Input:
1000

Output:
700

Burned:
300
```

Expected:

```text
output token amount < input token amount
```

when the operation explicitly represents a burn.

---

### 3.7 xUDT Lab

#### Purpose

The xUDT module explores more extensible token behavior than the basic sUDT model.

The current CellRoute implementation focuses on basic token lifecycle behavior:

```text
Mint
  |
  v
Transfer
  |
  v
Burn
```

The purpose of this module is to prepare for more advanced token rules such as:

- extension scripts
- custom validation
- protocol-specific authorization
- token policy constraints
- programmable token behavior

#### Expected behavior

The basic token conservation rules should remain visible and testable even as additional xUDT rules are introduced.

---

### 3.8 Transaction Validation Module

#### Purpose

The validation module catches obvious invalid transactions before they are submitted to the chain.

Example checks include:

```text
Capacity validation
Token amount validation
Cell structure validation
Required script presence
Issuer authorization
Input/output consistency
```

#### Validation pipeline

```text
User Request
    |
    v
Build Draft Transaction
    |
    v
Client-side Validation
    |
    +------ invalid ------> Reject locally
    |
    v
Sign
    |
    v
Submit
    |
    v
CKB Consensus + Script Validation
    |
    +------ invalid ------> Reject transaction
    |
    v
Committed
```

Client validation is not considered the source of truth.

The final authority is the CKB validation process.

---

### 3.9 Devnet Evidence Module

#### Purpose

The evidence module makes experiments reproducible.

For important operations, CellRoute records information such as:

```text
Operation
Transaction Hash
Input Cells
Output Cells
Token Amount
Script
Expected Result
Actual Result
Network
Timestamp
```

Example:

```json
{
  "operation": "sudt-transfer",
  "network": "devnet",
  "expected": "success",
  "transactionHash": "0x...",
  "inputAmount": "1000",
  "outputAmount": "1000"
}
```

#### Expected behavior

A reviewer should be able to reproduce or independently inspect the transaction using the recorded evidence.

---

### 3.10 Artifact Checksum Module

#### Purpose

The checksum mechanism helps confirm that the script binary tested during the demonstration corresponds to the intended build artifact.

Example:

```text
Script Source
     |
     v
Build
     |
     v
Binary Artifact
     |
     v
SHA-256
     |
     v
Recorded checksum
```

A mismatch should indicate that the reviewed binary is different from the expected artifact.

---

### 3.11 Script Runtime and Debugging Module

This is the focus of the next CellRoute stage.

#### Purpose

The module will expose how CKB executes scripts inside the CKB VM.

Conceptually:

```text
Transaction
    |
    v
Script Group
    |
    v
CKB VM
    |
    v
Execute Program
    |
    +------ exit 0 ------> PASS
    |
    └------ non-zero ----> FAIL
```

The module should eventually provide:

- script binary identification
- script group information
- script arguments
- witness information
- execution result
- exit code
- consumed cycles
- debugging output

---

## 4. Main Application Flows

### Flow A — Native CKB Transfer

```text
Connect Wallet
    ↓
Query Live Cells
    ↓
Select Inputs
    ↓
Create Receiver Output
    ↓
Create Change Output
    ↓
Sign
    ↓
Submit
    ↓
Transaction Committed
```

### Flow B — Store Data in a Cell

```text
Enter Data
    ↓
Encode Data
    ↓
Build Output Cell
    ↓
Sign
    ↓
Submit
    ↓
Find Cell
    ↓
Decode Data
```

### Flow C — Simple Lock

```text
Choose Secret
    ↓
Hash Secret
    ↓
Create Locked Cell
    ↓
Attempt Unlock
    ↓
Run Script
    ↓
Valid Preimage?
    ├── Yes → Cell consumed
    └── No  → Transaction rejected
```

### Flow D — sUDT Mint

```text
Issuer
   ↓
Create Token Cell
   ↓
Encode uint128 Amount
   ↓
sUDT Validation
   ↓
Submit
   ↓
Token Cell Created
```

### Flow E — sUDT Transfer

```text
Token Input Cells
      ↓
Read Amount
      ↓
Create Receiver Output
      ↓
Create Token Change
      ↓
Validate Conservation
      ↓
Submit
```

### Flow F — Token Burn

```text
Token Input
     ↓
Reduce Output Supply
     ↓
Validate Burn
     ↓
Submit
     ↓
Old Cells Consumed
```

---

## 5. Invariants

An invariant is something that should remain true for every valid execution.

These are the main invariants currently expected in CellRoute.

### 5.1 Cell Consumption Invariant

A consumed Cell cannot be spent twice.

```text
Cell(previous_out_point)
```

can transition from:

```text
LIVE → DEAD
```

but never:

```text
DEAD → LIVE
```

### 5.2 Capacity Invariant

For a normal transaction:

```text
Σ input_capacity >= Σ output_capacity
```

The difference is used as the transaction fee.

### 5.3 Lock Authorization Invariant

A Cell can only be consumed when its Lock Script succeeds.

```text
Lock Script exit code == 0
```

### 5.4 Simple Lock Invariant

For the hash-lock experiment:

```text
hash(preimage) == lock_args
```

must be true.

Otherwise the Cell must remain unspent.

### 5.5 Token Encoding Invariant

sUDT token amount must be interpreted consistently as:

```text
uint128 little-endian
```

Therefore:

```text
decode(encode(amount)) == amount
```

### 5.6 Token Transfer Conservation Invariant

For a normal transfer:

```text
Σ token_input == Σ token_output
```

Example:

```text
Input = 1000

Output A = 300
Output B = 700

1000 == 300 + 700
```

### 5.7 Unauthorized Mint Invariant

A user who does not satisfy the required issuer rule must not be able to increase token supply.

Conceptually:

```text
new_supply > previous_supply
```

requires valid mint authorization.

### 5.8 Transaction Determinism

Given equivalent:

```text
inputs
outputs
scripts
data
witnesses
```

the validation rules should produce the same result.

---

## 6. Variants

Variants are values that are expected to change between valid executions.

Examples include:

```text
Transaction Hash
Block Number
Cell OutPoint
Capacity Selection
Fee
Recipient Address
Token Amount
Change Amount
Witness Signature
Timestamp
Consumed Cycles
```

These should not normally be treated as fixed test assertions.

For example:

Bad test:

```text
expect(txHash).toEqual(
  "0x123456..."
)
```

Better test:

```text
expect(txHash).toMatch(/^0x[0-9a-f]{64}$/)
```

and then verify the transaction semantics independently.

---

## 7. What Reviewers Should Test

The tests should focus primarily on **state transitions and invariants**, rather than exact transaction hashes.

| Scenario | Expected Result |
|---|---|
| Valid CKB transfer | Accepted |
| Output exceeds input capacity | Rejected |
| Valid Simple Lock preimage | Accepted |
| Incorrect Simple Lock preimage | Rejected |
| Authorized sUDT mint | Accepted |
| Unauthorized mint | Rejected |
| Valid sUDT transfer | Accepted |
| Transfer creates additional supply | Rejected |
| Valid burn | Accepted |
| Invalid amount encoding | Rejected or handled safely |
| Already consumed Cell reused | Rejected |
| Missing required script dependency | Rejected |
| Valid script execution | Exit code 0 |
| Invalid script execution | Non-zero exit |

---

## 8. Example Reviewer Test Model

For every feature, testing can be structured as:

```text
Given
    initial Cells

When
    transaction is constructed

Then
    verify expected output Cells

And
    verify invariants

And
    submit to CKB

And
    verify script execution result
```

For example:

```text
Given:
Alice owns an sUDT Cell containing 1000 tokens.

When:
Alice transfers 300 tokens to Bob.

Then:
Bob receives a token Cell containing 300.

And:
Alice receives a change token Cell containing 700.

And:
total input token amount == total output token amount.

And:
the original 1000-token Cell becomes dead.

And:
the transaction is committed successfully.
```

Negative case:

```text
Given:
Alice owns 1000 tokens.

When:
a transaction tries to create 1200 tokens without valid mint authority.

Then:
the transaction must fail validation.

And:
the original token Cell must remain live.
```

---

## 9. Current Scope

CellRoute currently serves primarily as a CKB developer lab rather than a production payment application.

Current areas include:

```text
CKB Cell Model
Native transfers
Data Cells
Simple Lock
sUDT
basic xUDT
Devnet testing
transaction evidence
script validation
```

The next phase focuses on:

```text
CKB Script Runtime
CKB VM
WebAssembly
script debugging
cycle analysis
failure inspection
```

Future phases can extend this into:

```text
Fiber payment channels
multi-user payment flows
advanced xUDT rules
indexer-backed history
backend transaction tracking
AI-assisted transaction debugging
production monitoring
```

---

## 10. Summary

The core idea behind CellRoute is:

> A CKB transaction should be understood as a verifiable state transition between Cells.

For each CellRoute module, a reviewer should be able to determine:

```text
What existed before?
        ↓
What transaction was created?
        ↓
What validation rules were executed?
        ↓
What must remain invariant?
        ↓
What is allowed to vary?
        ↓
What Cells exist afterward?
```

If those questions can be answered clearly, the behavior of the module can be tested independently of the UI and independently of any specific transaction hash.

---

## Quick README Summary

### What does CellRoute do?

CellRoute is a CKB development lab that demonstrates how application state is represented and changed through Cells.

Each lab follows the same basic model:

`Live Cells → Transaction Inputs → Script Validation → Transaction Outputs → New Live Cells`

The application currently demonstrates native CKB transfers, Data Cells, Simple Lock, sUDT/xUDT token operations, transaction validation, and Devnet evidence collection.

The main properties reviewers should verify are not exact transaction hashes, but protocol invariants such as:

- consumed Cells cannot be reused;
- output capacity cannot exceed input capacity;
- a Lock Script must authorize Cell consumption;
- valid sUDT transfers conserve token amount;
- token supply can only increase through an authorized mint;
- burn operations intentionally decrease token supply;
- token amounts are encoded consistently as `uint128` little-endian.

Values such as transaction hashes, OutPoints, fees, timestamps, signatures, and block numbers are expected to vary between executions.
