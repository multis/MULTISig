#!/bin/bash

# running 'truffle test' does compile the contracts each time
# to avoid duplicate compilation for our 2 tests, 'truffle compile' does the trick
# this compiles the contracts for both tests once
truffle compile

# start an instance of ganache-cli, trap it in a background job
# redirect its output to /dev/null and kill it on exit
trap 'kill $!' EXIT
ganache-cli --allowUnlimitedContractSize --gasLimit=97219750 > /dev/null &

truffle test test/javascript/testGSNMultisigFactory.js
truffle test test/javascript/testGSNMultiSigWalletWithDailyLimit.js