# CoinLucks Protocol Subgraph

### CoinLucks > Web3 Fair-to-Win Platform

This subgraph indexes and queries data for the CoinLucks protocol, enabling efficient access to betting, raffle, and staking information across multiple blockchain networks.

The CoinLucks protocol subgraph is designed to track and organize data from various smart contracts, including bet games, raffles, staking, and referral systems. It provides a comprehensive view of the protocol's activities and user interactions.

## Repository Structure

- `abis/`: Contains JSON files defining the Application Binary Interfaces (ABIs) for various smart contracts used in the protocol.
- `config/`: Includes JSON configuration files for different networks (BSC, BSC Testnet, opBNB Testnet, and localhost).
- `src/mappings/`: Contains TypeScript files that define how to process and store events from the smart contracts.
- `schema.graphql`: Defines the GraphQL schema for the subgraph.
- `subgraph.template.yaml`: Template file for generating the subgraph manifest.
- `package.json`: Defines project dependencies and scripts for building and deploying the subgraph.

Key Files:
- `subgraph.template.yaml`: Main configuration file for the subgraph, defining data sources and mappings.
- `src/mappings/BetGame.ts`: Handles events related to bet games.
- `src/mappings/RaffleContract.ts`: Processes events from the raffle contract.
- `src/mappings/BetGameStaking.ts`: Manages staking-related events.
- `src/mappings/Referral.ts`: Handles referral system events.

## Usage Instructions

### Installation

Prerequisites:
- Node.js (v14 or later)
- Yarn package manager

To install the project dependencies, run:

```bash
yarn install
```

### Preparing the Subgraph

To prepare the subgraph for a specific network, use one of the following commands:

```bash
yarn prepare:bsc
yarn prepare:bscTestnet
yarn prepare:opBNBTestnet
yarn prepare:dev
```

These commands will generate the `subgraph.yaml` file from the template and the corresponding network configuration.

### Deploying the Subgraph

To deploy the subgraph to a specific network, use one of the following commands:

```bash
yarn deploy:bsc
yarn deploy:bscTestnet
yarn deploy:opBNBTestnet
yarn deploy:dev
```

Make sure to set the required environment variables before deploying:

- `THEGRAPH_TOKEN`: Your authentication token for The Graph hosted service.
- `GRAPH_NODE`: URL of the Graph Node (for non-hosted deployments).
- `GRAPH_NODE_KEY`: Deploy key for the Graph Node.
- `GRAPH_IPFS`: IPFS endpoint for the Graph Node.

### Development

For local development:

1. Create a local subgraph:
   ```bash
   yarn create:dev
   ```

2. Deploy to the local Graph Node:
   ```bash
   yarn deploy:dev
   ```

3. To remove the local subgraph:
   ```bash
   yarn delete:dev
   ```

## Data Flow

The CoinLucks protocol subgraph processes data from multiple smart contracts:

1. BetGameFactory: Creates new bet games and emits events when games are added.
2. BetGame: Handles bet placements, results, and claims.
3. RaffleContract: Manages raffle creation, ticket purchases, and prize distributions.
4. BetGameStaking: Processes staking, unstaking, and reward distribution events.
5. Referral: Tracks referral relationships between users.

```
[BetGameFactory] -> [BetGame] -> [Subgraph Indexer]
[RaffleContract] ----------------------^
[BetGameStaking] ---------------------^
[Referral] ---------------------------^
```

The subgraph indexer processes events from these contracts, updating entities in the GraphQL schema. This allows for efficient querying of protocol data, including bet history, raffle participation, staking positions, and referral information.

## Troubleshooting

Common issues and solutions:

1. Subgraph fails to sync:
   - Check that the contract addresses and start blocks in the configuration files are correct.
   - Ensure that the ABIs in the `abis/` directory match the deployed contracts.

2. GraphQL queries return unexpected results:
   - Review the entity definitions in `schema.graphql` to ensure they match your expectations.
   - Check the mapping logic in the corresponding TypeScript files under `src/mappings/`.

3. Deployment errors:
   - Verify that all environment variables are correctly set.
   - Ensure you have the necessary permissions for the target deployment environment.

For detailed logs and debugging:
- Use the Graph CLI's `graph logs` command to view indexing logs.
- Enable verbose logging in your Graph Node configuration for more detailed output.

## Infrastructure

The `subgraph.template.yaml` file defines the following key components:

- Data Sources:
  - RaffleContract
  - Referral
  - BetGameFactory

- Templates:
  - TokenMetadata
  - BetGame
  - BetGameStaking

Each data source and template specifies the relevant smart contract, ABI, and event handlers. The file also defines the context for each component, including the chain ID and network-specific details.

The subgraph uses these configurations to properly index and organize data from the CoinLucks protocol across different networks.