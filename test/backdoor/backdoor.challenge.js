const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("[Challenge] Backdoor", function () {
  let deployer, users, player, attacker;
  let masterCopy, walletFactory, token, walletRegistry;

  const AMOUNT_TOKENS_DISTRIBUTED = 40n * 10n ** 18n;

  before(async function () {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    [deployer, alice, bob, charlie, david, player, attacker] =
      await ethers.getSigners();
    users = [alice.address, bob.address, charlie.address, david.address];

    // Deploy Gnosis Safe master copy and factory contracts
    masterCopy = await (
      await ethers.getContractFactory("GnosisSafe", deployer)
    ).deploy();
    walletFactory = await (
      await ethers.getContractFactory("GnosisSafeProxyFactory", deployer)
    ).deploy();
    token = await (
      await ethers.getContractFactory("DamnValuableToken", deployer)
    ).deploy();

    // Deploy the registry
    walletRegistry = await (
      await ethers.getContractFactory("WalletRegistry", deployer)
    ).deploy(masterCopy.address, walletFactory.address, token.address, users);
    expect(await walletRegistry.owner()).to.eq(deployer.address);

    for (let i = 0; i < users.length; i++) {
      // Users are registered as beneficiaries
      expect(await walletRegistry.beneficiaries(users[i])).to.be.true;

      // User cannot add beneficiaries
      await expect(
        walletRegistry
          .connect(await ethers.getSigner(users[i]))
          .addBeneficiary(users[i])
      ).to.be.revertedWithCustomError(walletRegistry, "Unauthorized");
    }

    // Transfer tokens to be distributed to the registry
    await token.transfer(walletRegistry.address, AMOUNT_TOKENS_DISTRIBUTED);
  });

  it("Execution", async function () {
    /** CODE YOUR SOLUTION HERE */
    const attackerFactory = await ethers.getContractFactory(
      "BackdoorAttacker",
      player
    );

    console.log(
      "Before Player Transaction Count : ",
      await ethers.provider.getTransactionCount(player.address)
    );

    console.log("Init Wallet Registry Address : ", walletRegistry.address);
    console.log("Init Wallet Factory Address : ", walletFactory.address);
    console.log("Init Master Copy Address : ", masterCopy.address);

    console.log(
      "Before WalletRegistry Token Balance : ",
      await token.balanceOf(walletRegistry.address)
    );

    const attackerContract = await attackerFactory
      .connect(attacker)
      .deploy(
        walletRegistry.address,
        walletFactory.address,
        masterCopy.address,
        token.address
      );

    await attackerContract.connect(player).attack(users);

    console.log(
      "After WalletRegistry Token Balance : ",
      await token.balanceOf(walletRegistry.address)
    );

    console.log(
      "After Player Token Balance : ",
      await token.balanceOf(player.address)
    );

    console.log(
      "After Player Transaction Count : ",
      await ethers.provider.getTransactionCount(player.address)
    );
  });

  after(async function () {
    /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */

    // Player must have used a single transaction
    expect(await ethers.provider.getTransactionCount(player.address)).to.eq(1);

    for (let i = 0; i < users.length; i++) {
      let wallet = await walletRegistry.wallets(users[i]);

      // User must have registered a wallet
      expect(wallet).to.not.eq(
        ethers.constants.AddressZero,
        "User did not register a wallet"
      );

      // User is no longer registered as a beneficiary
      expect(await walletRegistry.beneficiaries(users[i])).to.be.false;
    }

    // Player must own all tokens
    expect(await token.balanceOf(player.address)).to.eq(
      AMOUNT_TOKENS_DISTRIBUTED
    );
  });
});
