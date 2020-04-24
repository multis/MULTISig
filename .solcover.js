module.exports = {
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true               // Run the grep's inverse set.
  },
  providerOptions: {
    "mnemonic": "curtain anchor bamboo hurt drink disagree gaze electric solar present rain joy", 
    "hardfork": "istanbul",
    "default_balance_ether": 1000000
  },
  skipFiles: []
};
