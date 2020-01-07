function getParamFromTxEvent(transaction, paramName, contractFactory, eventName) {
  assert.isObject(transaction)
  let logs = transaction.events
  if (eventName != null) {
    logs = transaction.events[eventName]
  }
  assert.isObject(logs, 'log not found!')
  let param = logs["returnValues"][paramName]
  if (contractFactory != null) {
    let contract = contractFactory.at(param)
    assert.isObject(contract, `getting ${paramName} failed for ${param}`)
    return contract
  } else {
    return param
  }
}

function mineBlock(web3, reject, resolve) {
  web3.currentProvider.send({
    method: "evm_mine",
    jsonrpc: "2.0",
    id: new Date().getTime()
  }, (e) => (e ? reject(e) : resolve()))
}

function increaseTimestamp(web3, increase) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      method: "evm_increaseTime",
      params: [increase],
      jsonrpc: "2.0",
      id: new Date().getTime()
    }, (e) => (e ? reject(e) : mineBlock(web3, reject, resolve)))
  })
}

function balanceOf(web3, account) {
  return web3.eth.getBalance(account).then((balance) => {
    return web3.utils.toBN(balance);
  })

  //return new Promise((resolve, reject) => web3.eth.getBalance(account, (e, balance) => (e ? reject(e) : resolve(balance))))
}

async function assertThrowsAsynchronously(test, error) {
  try {
    await test();
  } catch (e) {
    if (!error || e instanceof error)
      return "everything is fine";
  }
  throw new Error("Missing rejection" + (error ? " with " + error.name : ""));
}

Object.assign(exports, {
  getParamFromTxEvent,
  increaseTimestamp,
  balanceOf,
  assertThrowsAsynchronously,
})