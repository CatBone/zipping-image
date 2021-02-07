#!/usr/bin/env node
const packageJson = require('./package.json')
const ora = require('ora')
const chalk = require('chalk')
const commander = require('commander')
const { compress } = require('./util')

const loading = ora(chalk.blue('Running Compress...'))
const transferText = item =>
  `${item.path}  was: ${chalk.red(item.was)}  now: ${chalk.green(item.now)}  saving: ${chalk.green(item.saving)} (${chalk.green(
    item.rate
  )})`

commander
  .version(packageJson.version)
  .arguments('<fileName...>')
  // .option('-p, --path <path>', 'the path')
  .action(async fileNames => {
    loading.start()
    try {
      const data = await compress(fileNames)
      loading.stopAndPersist()
      data.forEach(item => {
        const logText = transferText(item)
        loading.succeed(logText)
      })
      loading.succeed(chalk.green('Finished'))
    } catch (error) {
      loading.fail(chalk.red(error.err_msg))
    }
  })
  .parse(process.argv)
