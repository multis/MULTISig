# GSN-enabled Multisig

A fork of gnosis multisigs to support the Gas Station Network (GSN)

# Description
In order to get an overview of the work being done here, please read this [todo: link to medium blog post about gasless]

# Documentation
The code is split in three parts:
- A MULTISig smart contract implemented in `GSNMultiSigWallet.sol`

A smart contract allowing multiple parties to agree on transactions before execution. Transactions can be executed only when confirmed by a predefined number of owners.
- A MULTISig smart contract with daily limit implemented in `GSNMultiSigWalletWithDailyLimit.sol`

Extends the previous smart contract by adding a new feature: the ability to set daily spending limits below which owners don't need confirmations.

- A factory smart contract implemented in `GSNMultisigFactory.sol`

Allows for the creation of the previous smart contracts and keeps track of deployments.

## GSN
Discussed in the article cited above, the implementation of GSN serves two roles
- allow for gasless deployments of the MULTISig smart contracts.
- allow for gasless transactions from the deployed smart contracts.

We relay on [OpenZeppelin](https://gsn.openzeppelin.com/) for implementing our GSN contracts, in order to offer gasless deployments, the factory extends `GSNRecipientERC20Fee`  as our main payment strategy for the factory. (to learn more about the concept of a ERC20 fee Recipient payment strategy, please refer to the official documentation [here](https://docs.openzeppelin.com/contracts/2.x/gsn-strategies#_how_to_use_gsnrecipienterc20fee))

The implementation of this payment strategy requires that we also extend `MinterRole`, in order to mint tokens that are going to be used for accepting relayed calls from GSN (you can read more about the other GSN payment strategies [here](https://docs.openzeppelin.com/contracts/2.x/gsn-strategies)).

In order to deploy a MULTISig smart contract, you need to call the `create` method, giving it a list of owner addresses, number of required confirmations for transactions, and finaly, the daily limit parameter discussed above. Uppon a successful call, this method will emit an `ContractInstantiation` event along with the address to which the contract has been deployed to.

### Gasless deployments
Given that your factory has enough funds in the Gas Station Netwok (discussed above in the GSN article, where you essentially deposit funds for an account at the corresponding RelayHub address for your network (mainnet, rinkeby, etc.)), you can offer gasless creation by offering your custom tokens to the account calling `create`, in order to do that, you first need to mint some tokens and then send them to the addresses you chose.

You mint tokens by calling the `mint` public function and specifying the address to which you wish to mint tokens along with the number of tokens (in wei)

In order to mint tokens, you need to be declared as a Minter, you do that by calling `addMinter` from the owner account that deployed the factory.

### Summary
- the factory extends `GSNRecipientERC20Fee` as a payment strategy
- in order to deploy a contract you call `create`
- address holding your custom minted tokens get to have gasless (free) deployments given your factory has enough funds in the Gas Station Network

## GSN for MULTISigs
Let's now discuss the GSN part when it comes to the actual MULTISigs. These two smart contracts extend `GSNRecipient`, effectively allowing them to join the Gas Station Network.

In order to offer gasless transactions to owners, all you need to do is fund your deployed smart contract.

In order to change the payment strategy, one needs to offer a different implementation to the `acceptRelayedCall` method, but since a multisignature smart contract is already protected by design to require confirmations for every transaction, there is no need for a complicated setup here, we decided to accept all relayed transactions given they will only be relayed if adhere to the multisignature requirements in the first place.

# Tests
Tests cover most operations and can be run using the provided `run_tests.sh` script.

# Contributing
If you want to contribute to this code, please follow the instructions below and send us a pull request.

## Setup

install npm dependencies

```
$ npm install
```

add an `.env` file with infura key and a 12-word mnemonic phrase:

```
INFURA_PROJECT_ID="your infura project id"
DEV_MNEMONIC="your mnemonic seed phrase"
```

init openzeppelin project

```
$ openzeppelin init
```

add the optimizer compiler settings inside of `compiler` key in `project.json` like the following: 

```json
{
  "manifestVersion": "2.2",
  "contracts": {},
  "dependencies": {},
  "name": "MULTISig",
  "version": "1.0.0",
  "compiler": {
    "manager": "openzeppelin",
    "solcVersion": "0.5.13",
    "compilerSettings": {
      "optimizer": {
        "enabled": true,
        "runs": "200"
      }
    }
  }
}
```
### Network settings
if you want to use a custom network, change settings in `networks.js` (rinkeby and ropsten have already been configured)

# Compile contracts
contracts source code is in `/contracts`, in order to compile them, run:
```shell
$ openzeppelin compile
```

contracts will be available in `build/contracts/*.json`

# Deploy contracts to Ethereum
```
$ openzeppelin create ContractName --network network-name
```

Example:
```
$ oz create GSNMultisigFactory --network rinkeby
✓ Compiled contracts with solc 0.5.13 (commit.5b0b510c)
- Variable _minters (MinterRole) contains a struct or enum. These are not automatically checked for storage compatibility in the current version. See https://docs.openzeppelin.com/sdk/2.5/writing_contracts.html#modifying-your-contracts for more info.
✓ Contract GSNMultisigFactory deployed
All contracts have been deployed
? Do you want to call a function on the instance after creating it? Yes
? Select which function * initialize(name: string, symbol: string)
? name (string): MultisCoin
? symbol (string): MCN
✓ Instance created at 0x3C3333F753AAf0Df4BF189849023e70aB8074F34
0x3C3333F753AAf0Df4BF189849023e70aB8074F34
```

# Call contract methods

```
$ openzeppelin send-tx --network network-name
```

Example

```
$ oz send-tx --network rinkeby
? Pick an instance GSNMultisigFactory at 0x3C3333F753AAf0Df4BF189849023e70aB8074F34
? Select which function mint(account: address, amount: uint256)
? account (address): 0xfb9678f3578e86e8a74d6b4f72eb9b3ffd5070f5
? amount (uint256): 10
✓ Transaction successful. Transaction hash: 0x5d847ef9354416686d03ee2417d23c33efefb56d369bb7b3d1b2c083ebd10809
```

## Test on local env

### On ganache
```bash
# run ganache in a separate terminal
$ ganache-cli
# compile contracts and write down the deployed address
$ openzepplin create
# deploy a local GSN (RelayHub + relayers)
# this step is not necessary if testing on rinkby or mainnet, GSN already exists there
$ npx oz-gsn run-relayer
# fund recipient
$ npx oz-gsn fund-recipient --recipient $address
```

At this point, the whole GSN and GSN-enabled smart contracts are operational on the local ganache instance