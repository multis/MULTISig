const utils = require('./utils');
const { TestHelper } = require('@openzeppelin/cli');
const { Contracts, ZWeb3 } = require('@openzeppelin/upgrades');

if (process.env.SOLIDITY_COVERAGE) {
  Contracts.setLocalBuildDir("./.coverage_artifacts/contracts");
}

global.web3 = web3;
ZWeb3.initialize(web3.currentProvider);

const GSNMultiSigWalletWithDailyLimit = Contracts.getFromLocal('GSNMultiSigWalletWithDailyLimit');
const GSNMultisigFactory = Contracts.getFromLocal('GSNMultisigFactory');
const ERC20 = Contracts.getFromLocal('ERC20')
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

  it('Add minter, mint and remove minter', async () => {
    await factoryInstance.methods.addMinter(accounts[1]).send({from: accounts[0], gas: GAS})
    assert.isTrue((await factoryInstance.methods.isMinter(accounts[1]).call()))

    await factoryInstance.methods.mint(accounts[2], 42).send({from: accounts[1], gas: GAS})
    const tokenAddr = await factoryInstance.methods.token().call()
    assert.equal(42, (await ERC20.at(tokenAddr).methods.balanceOf(accounts[2]).call()))

    await factoryInstance.methods.removeMinter(accounts[1]).send({from: accounts[0], gas: GAS})
    assert.isFalse((await factoryInstance.methods.isMinter(accounts[1]).call()))
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

  it('Receive money from contract transfer', async () => {
    const DumbTransfer = Contracts.getFromLocal('DumbTransfer')
    const dumbTransferInstance = await DumbTransfer.new({from: accounts[0], gas: GAS})
    const transferAmount = web3.utils.toWei("1", "ether")
    const tx = await dumbTransferInstance.methods.transfer(walletAddress).send({from: accounts[0], value: transferAmount, gas: GAS})

    const balance = await utils.balanceOf(web3, walletAddress)
    assert.equal(balance.valueOf(), web3.utils.toWei("2", "ether"))

    const log = utils.parseRawLog(tx.events[0],
      [{"indexed":true,"internalType":"address","name":"sender","type":"address"},
       {"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}]);
    assert.equal(log.sender, dumbTransferInstance.address)
    assert.equal(log.value, transferAmount)
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

  it('Add owner', async () => {
    const addOwnerEncoded = multisigInstance.methods.addOwner(accounts[2]).encodeABI()
    const transactionId = utils.getParamFromTxEvent(
      await multisigInstance.methods.submitTransaction(multisigInstance.options.address, 0, addOwnerEncoded).send({ from: accounts[0], gas: GAS }),
      'transactionId', null, 'Submission'
    )

    await multisigInstance.methods.confirmTransaction(transactionId).send({ from: accounts[1], gas: GAS })
    const owners = await multisigInstance.methods.getOwners().call()
    assert.equal(accounts[2], owners[2])
  })

  it('Replace owner', async () => {
    const addOwnerEncoded = multisigInstance.methods.replaceOwner(accounts[2], accounts[3]).encodeABI()
    const transactionId = utils.getParamFromTxEvent(
      await multisigInstance.methods.submitTransaction(multisigInstance.options.address, 0, addOwnerEncoded).send({ from: accounts[0], gas: GAS }),
      'transactionId', null, 'Submission'
    )

    await multisigInstance.methods.confirmTransaction(transactionId).send({ from: accounts[1], gas: GAS })
    assert.isFalse((await multisigInstance.methods.isOwner(accounts[2]).call()))
    assert.isTrue((await multisigInstance.methods.isOwner(accounts[3]).call()))
  })

  it('Remove owner', async () => {
    const removeOwnerEncoded = multisigInstance.methods.removeOwner(accounts[3]).encodeABI()
    const transactionId = utils.getParamFromTxEvent(
      await multisigInstance.methods.submitTransaction(multisigInstance.options.address, 0, removeOwnerEncoded).send({ from: accounts[0], gas: GAS }),
      'transactionId', null, 'Submission'
    )

    await multisigInstance.methods.confirmTransaction(transactionId).send({ from: accounts[1], gas: GAS })
    const isOwner = await multisigInstance.methods.isOwner(accounts[3]).call()
    assert.isFalse(isOwner)

    const removeOtherOwnerEncoded = multisigInstance.methods.removeOwner(accounts[0]).encodeABI()
    const txid = utils.getParamFromTxEvent(
      await multisigInstance.methods.submitTransaction(multisigInstance.options.address, 0, removeOtherOwnerEncoded).send({ from: accounts[1], gas: GAS }),
      'transactionId', null, 'Submission'
    )
    await multisigInstance.methods.confirmTransaction(txid).send({ from: accounts[0], gas: GAS })
    assert.isFalse((await multisigInstance.methods.isOwner(accounts[0]).call()))
    assert.equal(1, (await multisigInstance.methods.required().call()))
    
    const reAddOwnerEncoded = multisigInstance.methods.addOwner(accounts[0]).encodeABI()
    await multisigInstance.methods.submitTransaction(multisigInstance.options.address, 0, reAddOwnerEncoded).send({ from: accounts[1], gas: GAS })

    const changeRequirementEncoded = multisigInstance.methods.changeRequirement(2).encodeABI()
    await multisigInstance.methods.submitTransaction(multisigInstance.options.address, 0, changeRequirementEncoded).send({ from: accounts[1], gas: GAS })
    assert.equal(2, (await multisigInstance.methods.required().call()))
  })

  it('Revoke confirmation', async () => {
    const transactionId = utils.getParamFromTxEvent(
      await multisigInstance.methods.submitTransaction(accounts[4], web3.utils.toWei("0.1", "ether"), "0x").send({ from: accounts[0], gas: GAS }),
      'transactionId', null, 'Submission'
    )

    assert.equal(1, (await multisigInstance.methods.getConfirmationCount(transactionId).call()))
    await multisigInstance.methods.revokeConfirmation(transactionId).send({from: accounts[0], gas: GAS})
    assert.equal(0, (await multisigInstance.methods.getConfirmationCount(transactionId).call()))

    await multisigInstance.methods.confirmTransaction(transactionId).send({ from: accounts[0], gas: GAS })
    const confirmations = await multisigInstance.methods.getConfirmations(transactionId).call()
    assert.equal(accounts[0], confirmations[0])
  })

  it('Change requirement', async () => {
    const newRequirement = 1
    const changeRequirementEncoded = multisigInstance.methods.changeRequirement(newRequirement).encodeABI()
    const transactionId = utils.getParamFromTxEvent(
      await multisigInstance.methods.submitTransaction(multisigInstance.options.address, 0, changeRequirementEncoded).send({ from: accounts[0], gas: GAS }),
      'transactionId', null, 'Submission'
    )

    await multisigInstance.methods.confirmTransaction(transactionId).send({ from: accounts[1], gas: GAS })
    assert.equal(newRequirement, (await multisigInstance.methods.required().call()))
  })

  it('Execute transaction', async () => {
    const transactionsCount = await multisigInstance.methods.getTransactionCount(true, true).call()
    const pendingTransactionIds = await multisigInstance.methods.getTransactionIds(0, transactionsCount, true, false).call()
    const transactionId = pendingTransactionIds[0]
    await multisigInstance.methods.executeTransaction(transactionId).send({from: accounts[0], gas: GAS})
    const transaction = await multisigInstance.methods.transactions(transactionId).call()
    assert.isTrue(transaction.executed)
  })

  it('Fail execution of transaction', async () => {
    const transactionId = utils.getParamFromTxEvent(
      await multisigInstance.methods.submitTransaction(accounts[4], web3.utils.toWei("1000", "ether"), "0x").send({ from: accounts[0], gas: GAS }),
      'transactionId', null, 'Submission'
    )
    const transaction = await multisigInstance.methods.transactions(transactionId).call()
    assert.isFalse(transaction.executed)
  })

  it('Fail execution of transaction below daily limit', async () => {
    const dailyLimitEncoded = multisigInstance.methods.changeDailyLimit(web3.utils.toWei("1000", "ether")).encodeABI()
    await multisigInstance.methods.submitTransaction(multisigInstance.options.address, 0, dailyLimitEncoded).send({ from: accounts[0], gas: GAS })

    const changeRequirementEncoded = multisigInstance.methods.changeRequirement(2).encodeABI()
    await multisigInstance.methods.submitTransaction(multisigInstance.options.address, 0, changeRequirementEncoded).send({ from: accounts[0], gas: GAS })

    const transactionId = utils.getParamFromTxEvent(
      await multisigInstance.methods.submitTransaction(accounts[4], web3.utils.toWei("100", "ether"), "0x").send({ from: accounts[0], gas: GAS }),
      'transactionId', null, 'Submission'
    )
    const transaction = await multisigInstance.methods.transactions(transactionId).call()
    assert.isFalse(transaction.executed)
  })
})