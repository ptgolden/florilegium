"use strict";

const path = require('path')
    , test = require('blue-tape')
    , leveldown = require('leveldown')
    , initStore = require('../store')
    , actions = require('../actions')

const TEST_DB_DIR = path.join(__dirname, 'test.db');

function initTest(initialState) {
  const store = initStore(TEST_DB_DIR, initialState)

  const destroy = () => new Promise((resolve, reject) =>
    store.db.close(err => {
      if (err) reject(err);

      leveldown.destroy(TEST_DB_DIR, err => {
        if (err) reject(err);
        resolve();
      })
    }))

  return { store, destroy }

}

function writeError(err) {
  process.stderr.write(err.stack + '\n');
}

test('Creating a store', async t => {
  const { store, destroy } = initTest()

  try {

    store.dispatch((dispatch, getState, extraArgs) => {
      t.deepEqual(
        Object.keys(extraArgs),
        ['pdfDB', 'annotDB', 'notebookDB'],
        'should pass sublevels to action creators dispatched on store')
    })
  } catch (err) {
    writeError(err);
  } finally {
    await destroy();
  }

  return
})

test('Saving a pdf', async t => {
  const { store, destroy } = initTest()

  try {
    const pdf = path.join(__dirname, '../../node_modules/pdf2oac/js/test/pdfs/1_comment/evince.pdf')

    await store.dispatch(actions.addNotebook(pdf, 'test notebook', 'it\'s a test notebook'));
    await store.dispatch(actions.listNotebooks())

    const { availableNotebooks } = store.getState()

    t.equal(availableNotebooks.length, 1);

    await store.dispatch(actions.getAnnotsForNotebook(store.getState().availableNotebooks[0].id));

    t.equal(store.getState().openedSource.annotations.length, 1);

  } catch (err) {
    writeError(err);
  } finally {
    await destroy();
  }

  return;
})
