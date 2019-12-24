const GSNMultiSigWalletWithDailyLimit = artifacts.require('GSNMultiSigWalletWithDailyLimit')
const web3 = GSNMultiSigWalletWithDailyLimit.web3
const deployMultisig = (owners, confirmations, limit) => {
    return GSNMultiSigWalletWithDailyLimit.new(owners, confirmations, limit);
}

const utils = require('./utils')
const ONE_DAY = 24 * 3600

contract('GSNMultiSigWalletWithDailyLimit', (accounts) => {
    let multisigInstance;
    const dailyLimit = web3.utils.toWei("3000", "ether");
    const requiredConfirmations = 2;

    beforeEach(async () => {
        multisigInstance = await deployMultisig([accounts[0], accounts[1]], requiredConfirmations, dailyLimit);
        assert.ok(multisigInstance)
    })

    it('create multisig', async () => {
        const deposit = 10000

        // Send money to wallet contract
        await web3.eth.sendTransaction({ to: multisigInstance.address, value: deposit, from: accounts[0] })
        const balance = await utils.balanceOf(web3, multisigInstance.address)
        assert.equal(balance.valueOf(), deposit)
        assert.equal(dailyLimit, await multisigInstance.dailyLimit())
        assert.equal(dailyLimit, await multisigInstance.calcMaxWithdraw())

        // Withdraw daily limit
        const value1 = 2
        const value1BN = web3.utils.toBN(value1.toString())
        let owner1Balance = await utils.balanceOf(web3, accounts[0])
        await multisigInstance.submitTransaction(accounts[0], value1, web3.utils.fromAscii(""), { from: accounts[1] })
        let newOwner1Balance = await utils.balanceOf(web3, accounts[0])
        assert.equal(
            owner1Balance.add(value1BN).toString(),
            newOwner1Balance.toString()
        )
        assert.equal(
            balance.sub(value1BN).toString(),
            (await utils.balanceOf(web3, multisigInstance.address)).toString()
        )


    })
})