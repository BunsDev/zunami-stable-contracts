async function main() {
    console.log('Start deploy');
    const zunamiAddress = "0x2ffCC661011beC72e1A9524E12060983E74D14ce";
    const ZunamiRedistributor = await ethers.getContractFactory("ZunamiRedistributor");
    const redistributor = await ZunamiRedistributor.deploy(zunamiAddress);

    await redistributor.deployed();
    console.log(`ZunamiRedistributor deployed to:`, redistributor.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
