const fs = require('fs')
const tinify = require('tinify')
const p = require('path')
const FileType = require('file-type')
const packageJson = require('./package.json')
tinify.key = packageJson.key

function getFileSize(filePath) {
  const stat = fs.statSync(filePath)
  return stat.size
}

function isCompressed(filePath) {
  return new Promise(resolve => {
    const rs = fs.createReadStream(filePath)
    rs.on('data', function (data) {
      const compressed = data.toString().includes('_compress')
      return resolve(compressed)
    })
  })
}

function writeBuffer(filePath) {
  return new Promise(resolve => {
    const rs = fs.createReadStream(filePath)

    rs.on('data', function (data) {
      const buf = Buffer.from('_compress')
      const newBuf = Buffer.concat([data, buf])
      const ws = fs.createWriteStream(filePath)
      ws.write(newBuf)
      ws.end()
      resolve()
    })
  })
}

function saving(max, min) {
  return (((max - min) / max) * 100).toFixed(2) + '%'
}

function toSizeFixed(size) {
  if (size < 1024) {
    return size + 'B'
  }
  if (size < 1024 * 1024) {
    return (size / 1024).toFixed(2) + 'KB'
  }
  return (size / 1024 / 1024).toFixed(2) + 'MB'
}

function getFileList(pathList) {
  return pathList.map(path => transferFileList(path)).flat(Infinity)
}

function transferFileList(path, fileList = []) {
  const stat = fs.statSync(path)
  if (stat.isDirectory()) {
    const files = fs.readdirSync(path)
    files.forEach(item => {
      const child = p.join(path, item)
      transferFileList(child, fileList)
    })
  } else {
    fileList.push(path)
  }
  return fileList
}

async function getImageList(paths) {
  const list = []
  for (const path of paths) {
    const type = await FileType.fromFile(path)
    if (type && /jpg|png/.test(type.ext)) {
      list.push(path)
    }
  }
  return list
}

/**
 * @param {string[]} fileList
 */
function getResolveList(fileList) {
  if (!packageJson.key) {
    return [Promise.reject({ err_msg: '请先阅读readme, 添加key' })]
  }
  return fileList.map(async fileName => {
    const cwd = process.cwd()
    const filePath = p.resolve(cwd, fileName)
    const was = getFileSize(filePath)
    try {
      // todo
      const compress = await isCompressed(filePath)
      if (!compress) {
        console.log('tiny !!!!')
        const source = tinify.fromFile(filePath)
        await source.toFile(filePath)
        writeBuffer(filePath)
      }
      const now = getFileSize(filePath)
      return {
        path: filePath.replace(cwd + '/', ''),
        was: toSizeFixed(was),
        now: toSizeFixed(now),
        saving: toSizeFixed(was - now),
        rate: saving(was, now),
      }
    } catch (error) {
      const { status } = error
      let err_msg
      switch (status) {
        case 401:
          err_msg = 'Credentials are invalid'
          break
        case 429:
          err_msg = '您本月次数已经用完, 请更新tinify.key'
        default:
          err_msg = error
          break
      }
      return Promise.reject({
        status,
        err_msg,
      })
    }
  })
}

module.exports = {
  async compress(fileList) {
    const pathList = getFileList(fileList)
    const imageList = await getImageList(pathList)
    return Promise.all(getResolveList(imageList))
  },
}
