#!/bin/bash
truffle compile

trap 'kill $!' EXIT
ganache-cli --allowUnlimitedContractSize --gasLimit=97219750 > /dev/null &

truffle test test/javascript/testGSNMultisigFactory.js
truffle test test/javascript/testGSNMultiSigWalletWithDailyLimit.js