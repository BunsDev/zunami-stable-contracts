async function main() {
    console.log('Start deploy');
    const Uzd = await ethers.getContractFactory('Uzd');
    const uzd = await Uzd.deploy();

    await uzd.deployed();
    console.log('Uzd deployed to:', uzd.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
