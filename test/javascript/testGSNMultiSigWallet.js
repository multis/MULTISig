const { TestHelper } = require('@openzeppelin/cli');
const { Contracts, ZWeb3 } = require('@openzeppelin/upgrades');

if (process.env.SOLIDITY_COVERAGE) {
    Contracts.setLocalBuildDir("./.coverage_artifacts/contracts");
  }

global.web3 = web3;
ZWeb3.initialize(web3.currentProvider);

const GSNMultiSigWallet = Contracts.getFromLocal('GSNMultiSigWallet');

const utils = require('./utils')
const ONE_DAY = 24 * 3600
const GAS = 9721975

describe('GSNMultiSigWallet', () => {
    let multisigInstance, accounts;
    const requiredConfirmations = 1;
    const initialDeposit = web3.utils.toWei("1", "ether");

    beforeEach(async () => {
        accounts = await ZWeb3.accounts();
        this.project = await TestHelper();
        multisigInstance = await this.project.createProxy(GSNMultiSigWallet, {
            initMethod: 'initialize',
            initArgs: [[accounts[0], accounts[1]], requiredConfirmations],
            from: accounts[1]
        });

        assert.ok(multisigInstance)

        // Send money to wallet contract
        await web3.eth.sendTransaction({ to: multisigInstance.options.address, value: initialDeposit, from: accounts[0] })
    })

    it('Fail execution of transaction', async () => {
        const transactionId = utils.getParamFromTxEvent(
            await multisigInstance.methods.submitTransaction(accounts[4], web3.utils.toWei("1000", "ether"), "0x").send({ from: accounts[0], gas: GAS }),
            'transactionId', null, 'Submission'
          )
          const transaction = await multisigInstance.methods.transactions(transactionId).call()
          assert.isFalse(transaction.executed)
    })

    it('Execute transaction', async () => {
        const transactionId = utils.getParamFromTxEvent(
            await multisigInstance.methods.submitTransaction(accounts[4], web3.utils.toWei("0.1", "ether"), "0x").send({ from: accounts[0], gas: GAS }),
            'transactionId', null, 'Submission'
          )
          const transaction = await multisigInstance.methods.transactions(transactionId).call()
          assert.isTrue(transaction.executed)
    })

    it('Accept relay call', async () => {
        const tuple = await multisigInstance.methods.acceptRelayedCall(accounts[8], accounts[1], "0x", 1, 2, 3, 4, "0x", 5).call()
        assert.equal(0, tuple[0])
    })
})
