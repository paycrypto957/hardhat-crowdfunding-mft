# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hardhat-based Solidity smart-contract project (the default "Sample Hardhat Project" scaffold).
Solidity `0.8.28`. Tooling is provided entirely by `@nomicfoundation/hardhat-toolbox` v6 (installed: Hardhat 2.28.6), which bundles ethers v6, hardhat-chai-matchers, network-helpers, Hardhat Ignition, TypeChain, and solidity-coverage — there is no separate per-plugin config.

## Commands

> **Note:** do NOT run `npm test`. The `test` script in [package.json](package.json) is the unused npm placeholder (`echo "Error..." && exit 1`). All tasks go through the Hardhat CLI.

- Compile contracts: `npx hardhat compile`
- Run all tests: `npx hardhat test`
- Run a single test file: `npx hardhat test test/Lock.js`
- Run a single test by name: `npx hardhat test --grep "Should set the right owner"`
- Run tests with gas reporting: `REPORT_GAS=true npx hardhat test`
- Start a local JSON-RPC node (chainId 31337) for interactive dev: `npx hardhat node`
- Deploy via Hardhat Ignition to the local node: `npx hardhat ignition deploy ./ignition/modules/Lock.js --network localhost`
- Generate coverage report: `npx hardhat coverage`
- Task help: `npx hardhat help`

## Architecture

Three directories, one purpose each:

- [contracts/](contracts/) — Solidity source. `Lock.sol` is a time-lock vault: constructor takes a future `_unlockTime` and locks sent ETH; `withdraw()` is callable only by `owner` once `block.timestamp >= unlockTime`.
- [test/](test/) — JavaScript tests (CommonJS `require`, not TypeScript) using Chai + the toolbox's chai-matchers and network-helpers. Tests use the **fixture pattern**: a `deployOneYearLockFixture` async function is run once and snapshotted via `loadFixture`, then reset per `it` block. Time manipulation is done with `time.latest()` / `time.increaseTo(...)`; impersonating other accounts uses `lock.connect(otherAccount)`.
- [ignition/modules/](ignition/modules/) — Hardhat Ignition deployment modules built with `buildModule`. [Lock.js](ignition/modules/Lock.js) declares the `Lock` contract with overridable `unlockTime` / `lockedAmount` parameters (defaults: Jan 1 2030, 1 GWEI). Local-node deployments land in `ignition/deployments/chain-31337` (gitignored).

When adding a new contract, follow the existing triad: add the `.sol` in `contracts/`, an Ignition module in `ignition/modules/`, and a fixture-based test in `test/`. [hardhat.config.js](hardhat.config.js) sets the single global compiler version (`solidity: "0.8.28"`); any contract with `pragma solidity ^0.8.28` compiles under it.

Tests use ethers v6 conventions — deployed contract address is `lock.target`, not `lock.address`.
