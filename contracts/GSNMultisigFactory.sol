pragma solidity 0.5.13;

import "@openzeppelin/contracts-ethereum-package/contracts/GSN/GSNRecipientERC20Fee.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/roles/MinterRole.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import 'hardlydifficult-ethereum-contracts/contracts/proxies/CloneFactory.sol';

import "./GSNMultiSigWalletWithDailyLimit.sol";

contract GSNMultisigFactory is GSNRecipientERC20Fee, MinterRole, Ownable {
    using CloneFactory for address;

    mapping(address => address[]) public deployedWallets;
    mapping(address => bool) public isMULTISigWallet;
    address public masterCopy;

    event ContractInstantiation(address sender, address instantiation);

    function initialize(string memory name, string memory symbol) initializer public 
    {
        GSNRecipientERC20Fee.initialize(name, symbol);
        MinterRole.initialize(_msgSender());
        Ownable.initialize(_msgSender());
    }

    function mint(address account, uint256 amount) public onlyMinter {
        _mint(account, amount);
    }

    function removeMinter(address account) public onlyOwner {
        _removeMinter(account);
    }

    function setMasterCopy(address _masterCopy) public onlyOwner {
        masterCopy = _masterCopy;
    }   

    /*
     * Public functions
     */
    /// @dev Returns number of instantiations by creator.
    /// @param creator Contract creator.
    /// @return Returns number of instantiations by creator.
    function getDeployedWalletsCount(address creator) public view returns(uint) {
        return deployedWallets[creator].length;
    }

    function create(address[] memory _owners, uint _required, uint _dailyLimit) public payable returns (address payable wallet) {
        wallet = address(uint160(masterCopy.createClone()));
        GSNMultiSigWalletWithDailyLimit(wallet).initialize(_owners, _required, _dailyLimit);

        isMULTISigWallet[wallet] = true;
        deployedWallets[_msgSender()].push(wallet);

        emit ContractInstantiation(_msgSender(), wallet);
    }
}
