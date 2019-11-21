# GSN-enabled Multisig

A fork of gnosis multisigs to support the Gas Station Network (GSN)

# Setup

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
add the optimizer compiler settings inside of `"compiler"` key in `project.json`

```
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
}```

* if you want to use a custom network, change settings in `networks.js` (rinkeby and ropsten have already been configured)

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