#!/bin/bash

# running 'truffle test' does compile the contracts each time
# to avoid duplicate compilation for our 2 tests, 'truffle compile' does the trick
# this compiles the contracts for both tests, once
npx truffle compile

# start an instance of ganache-cli, trap it in a background job
# redirect its output to /dev/null and kill it on exit
trap 'kill $!' EXIT
npx ganache-cli --allowUnlimitedContractSize --gasLimit=97219750 > /dev/null &

npx truffle test test/javascript/testGSNMultisigFactory.js
npx truffle test test/javascript/testGSNMultiSigWalletWithDailyLimit.js