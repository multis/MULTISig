const GSNMultisigFactory = artifacts.require('GSNMultisigFactory');
const GSNMultiSigWalletWithDailyLimit = artifacts.require('GSNMultiSigWalletWithDailyLimit');
const web3 = GSNMultisigFactory.web3;

const utils = require('./utils');

contract('GSNMultisigFactory', (accounts) => {
  let factoryInstance, walletAddress, multisigInstance
  const dailyLimit = web3.utils.toWei("3", "ether")
  const requiredConfirmations = 2

  beforeEach(async () => {
    factoryInstance = await GSNMultisigFactory.new("Crypto token", "cdt")
    assert.ok(factoryInstance)
  })

  it('Create contract from factory', async () => {
    const tx = await factoryInstance.create([accounts[0], accounts[1]], requiredConfirmations, dailyLimit)
    walletAddress = utils.getParamFromTxEvent(tx, 'instantiation', null, 'ContractInstantiation')
    const walletCount = await factoryInstance.getDeployedWalletsCount(accounts[0])
    const multisigWalletAddress = await factoryInstance.deployedWallets(accounts[0], walletCount - 1)
    assert.equal(walletAddress, multisigWalletAddress)
    assert.ok(factoryInstance.isMULTISigWallet(walletAddress))
  })

  it('Send money to contract', async () => {
    // Send money to wallet contract
    multisigInstance = await GSNMultiSigWalletWithDailyLimit.at(walletAddress)
    const deposit = web3.utils.toWei("1", "ether")
    await web3.eth.sendTransaction({ to: walletAddress, value: deposit, from: accounts[0] })
    const balance = await utils.balanceOf(web3, walletAddress)
    assert.equal(balance.valueOf(), deposit)
    assert.equal(dailyLimit, await multisigInstance.dailyLimit())
    assert.equal(dailyLimit, await multisigInstance.calcMaxWithdraw())
  })

  it('Update daily limit', async () => {
    // Update daily limit
    const dailyLimitUpdated = 2000
    const dailyLimitEncoded = multisigInstance.contract.methods.changeDailyLimit(dailyLimitUpdated).encodeABI()
    const transactionId = utils.getParamFromTxEvent(
      await multisigInstance.submitTransaction(multisigInstance.address, 0, dailyLimitEncoded, { from: accounts[0] }),
      'transactionId', null, 'Submission'
    )

    await multisigInstance.confirmTransaction(transactionId, { from: accounts[1] })
    assert.equal(dailyLimitUpdated, (await multisigInstance.dailyLimit()).toNumber())
    assert.equal(dailyLimitUpdated, (await multisigInstance.calcMaxWithdraw()).toNumber())
  })
})