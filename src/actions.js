"use strict";

const fs = require('fs')
    , path = require('path')
    , N3 = require('n3')
    , pump = require('pump')
    , concat = require('concat-stream')
    , through = require('through2')
    , parseAnnots = require('pdf2oac')
    , ld = require('./ld')

module.exports = {
  listNotebooks,
  addNotebook,
  getPDFDocument,
}



/*
function dumpTurtle(graph=null) {
  return async (dispatch, getState, { graphDB }) => {
    const docs = await new Promise((resolve, reject) =>
      pump(
        graphDB.getStream({}),
        N3.StreamWriter({ prefixes: ld.prefixes }),
        concat(data => {
          resolve(data)
        }))
      .on('error', reject)
    )

    return docs;
  }
}
*/

function listNotebooks() {
  return async (dispatch, getState, { graphDB }) => {
    const { $ } = ld
        , db = graphDB

    const docs = await new Promise((resolve, reject) =>
      db.search(
        $(db.v('uri'))({
          'rdf:type': 'flor:Notebook',
          'rdfs:label': db.v('name'),
          'dce:description': db.v('description')
        }), (err, list) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(list)
        }))

    return docs;
  }
}

function getPDFDocument(pdfURI) {
  return async (dispatch, getState, { pdfDB }) => {
    await new Promise((resolve, reject) =>
      pump(pdfDB.createReadStream(pdfURI), concat(data => {
        data;
      })).on('error', reject).on('done', resolve))
  }
}

function addNotebook(pdfFilename, name, description) {
  const {
    notebookTriples,
    notebookURI,
    pdfURI,
    annotCollectionURI
  } = ld.generateNotebook(path.basename(pdfFilename), name, description)

  return async (dispatch, getState, { graphDB, pdfDB }) => {
    await new Promise((resolve, reject) => {
      fs.createReadStream(pdfFilename)
        .on('error', reject)
        .pipe(pdfDB.createWriteStream(pdfURI))
        .on('error', reject)
        .on('close', () => resolve())
    })

    await new Promise((resolve, reject) => {
      const opts = {
        pdfURI,
        graphURI: notebookURI,
        baseURI: notebookURI + '#',
      }

      let first = true

      const annotStream = pump(parseAnnots(pdfFilename, opts), through.obj(function (triple, enc, cb) {
        if (first) {
          notebookTriples.forEach(triple => {
            this.push(triple);
          })

          first = false;
        }

        if (ld.matchesType('oa:Annotation', triple)) {
          this.push(ld.$.withGraph(notebookURI)(annotCollectionURI)('pcdm:hasPart')(triple.subject));
        }

        this.push(triple)
        cb();
      }))

      annotStream
        .on('error', reject)
        .pipe(graphDB.putStream())
        .on('error', reject)
        .on('close', () => resolve())
    })

    return;
  }
}
