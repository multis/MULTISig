const utils = require('./utils');
const { TestHelper } = require('@openzeppelin/cli');
const { Contracts, ZWeb3 } = require('@openzeppelin/upgrades');

global.web3 = web3;
ZWeb3.initialize(web3.currentProvider);

const GSNMultiSigWalletWithDailyLimit = Contracts.getFromLocal('GSNMultiSigWalletWithDailyLimit');
const GSNMultisigFactory = Contracts.getFromLocal('GSNMultisigFactory');
const GAS = 9721975

describe('GSNMultisigFactory', () => {
  let factoryInstance, walletAddress, multisigInstance, accounts
  const dailyLimit = web3.utils.toWei("3", "ether")
  const requiredConfirmations = 2

  beforeEach(async () => {
    accounts = await ZWeb3.accounts();
    this.project = await TestHelper();
    factoryInstance = await this.project.createProxy(GSNMultisigFactory, {
      initMethod: 'initialize',
      initArgs: ["Crypto token", "cdt"]
    });

    assert.ok(factoryInstance)
  })

  it('Create contract from factory', async () => {
    const tx = await factoryInstance.methods.create([accounts[0], accounts[1]], requiredConfirmations, dailyLimit).send({ from: accounts[0], gas: GAS })
    walletAddress = utils.getParamFromTxEvent(tx, 'instantiation', null, 'ContractInstantiation')
    const walletCount = await factoryInstance.methods.getDeployedWalletsCount(accounts[0]).call()
    const multisigWalletAddress = await factoryInstance.methods.deployedWallets(accounts[0], walletCount - 1).call()
    assert.equal(walletAddress, multisigWalletAddress)
    assert.ok(await factoryInstance.methods.isMULTISigWallet(walletAddress).call())
  })

  it('Send money to contract', async () => {
    // Send money to wallet contract
    multisigInstance = await GSNMultiSigWalletWithDailyLimit.at(walletAddress)
    const deposit = web3.utils.toWei("1", "ether")
    await web3.eth.sendTransaction({ to: walletAddress, value: deposit, from: accounts[0] })
    const balance = await utils.balanceOf(web3, walletAddress)
    assert.equal(balance.valueOf(), deposit)
    assert.equal(dailyLimit, await multisigInstance.methods.dailyLimit().call())
    assert.equal(dailyLimit, await multisigInstance.methods.calcMaxWithdraw().call())
  })

  it('Update daily limit', async () => {
    // Update daily limit
    const dailyLimitUpdated = 2000
    const dailyLimitEncoded = multisigInstance.methods.changeDailyLimit(dailyLimitUpdated).encodeABI()
    const transactionId = utils.getParamFromTxEvent(
      await multisigInstance.methods.submitTransaction(multisigInstance.options.address, 0, dailyLimitEncoded).send({ from: accounts[0], gas: GAS }),
      'transactionId', null, 'Submission'
    )

    await multisigInstance.methods.confirmTransaction(transactionId).send({ from: accounts[1], gas: GAS })
    assert.equal(dailyLimitUpdated, (await multisigInstance.methods.dailyLimit().call()))
    assert.equal(dailyLimitUpdated, (await multisigInstance.methods.calcMaxWithdraw().call()))
  })
})