import { useEffect, useState, useRef, useCallback } from 'preact/hooks';
import { h, Component, render, options } from 'preact';

// preact option hook for tracking components:

const oldHook = options.__r;
export var currentComponent;

options.__r = (vnode) => {
  currentComponent = vnode.__c
  if (oldHook) {
    oldHook(vnode);
  }
}


// stateData :: [{object}]
// the container for the actual data being queried
// NOTE: this can be removed because of the Index,
//   but causes issues with non-indexed 'empty' selections that need a list of every
//   might want to switch to Set objects for this and the index
// NOTE: test memory usage with full build at some point
var stateData = [];

// stateIndex :: key: value: [data]
// index connecting key-value pairs to data objects and selectors
var stateIndex = new Map();

// communication object used to pass subscription data
var context;

// array of inner subscription state
var subscriptionTable = [];

// index counter for auto-generated ids
var idIndex = 0;


// state manipulation functions:

const getIndexObject = (key, value, write = false) => {
  var innerMap = stateIndex.get(key)
  if (!innerMap) {
    if (write) {
      innerMap = new Map();
      stateIndex.set(key, innerMap)
    } else {
      return null
    }
  }
  var obj = innerMap.get(value)
  if (!obj) {
    if (write) {
      obj = []
      innerMap.set(value, obj)
    } else {
      return null
    }
  }
  return obj
}

const normalizeQuery = (queries) => {
  const query = {valueQuery: {}, functions: []}

  queries.forEach(q => {
    if (q instanceof Function) {
      query.functions.push(q)
    } else {
      Object.assign(query.valueQuery, q)
    }
  })

  return query
}

const createWriteContext = () => {
  context = {writeContext: true, editedObjects: []}
}

const wrapWriteContext = (f, args) => {
  var r;
  if (!context) {
    createWriteContext()
    r = f.apply(null, args)
    commit()
  } else {
    r = f.apply(null, args)
  }
  return r;
}

export const filter = (...args) => {
  const [filterList] = args.slice(-1)
  const query = normalizeQuery(args.slice(0, -1))
  const selection = innerSelect(query)
  if (!context.writeContext) {
    // we're in a subscription
    const state = {query, lastSelection: selection, filter: true, filterList}
    const array = context.subscription.selectors
    array.push(state)
  }
  return selection
}

export const select = (...args) =>
  wrapWriteContext(_select, [args])

const _select = (args) => {
  const query = normalizeQuery(args)
  const selection = innerSelect(query)
  if (!context.writeContext) {
    // we're in a subscription, append selection data for efficient updates
    const state = {query, lastSelection: selection}
    const array = context.subscription.selectors
    array.push(state)
  }
  return selection
}

const indexKeyValue = (key, value, obj) => {
  if (!(value instanceof Function)) {
    getIndexObject(key, value, true).push(obj)
  }
}

const indexObject = (obj) => {
  for (let key in obj) {
    let value = obj[key]
    indexKeyValue(key, value, obj)
  }
  stateData.push(obj)
}

const unindexKeyValue = (key, value, target) => {
  if (!(value instanceof Function)) {
    const valueArray = getIndexObject(key, value)
    valueArray.splice(valueArray.indexOf(target), 1)
    if (valueArray.length == 0) {
      stateIndex.get(key).delete(value)
    }
  }
}

const unindexObject = (obj) => {
  stateData.splice(stateData.indexOf(obj), 1)
  for (const key in obj) {
    let value = obj[key]
    unindexKeyValue(key, value, obj)
  }
}

export const create = (obj) =>
  wrapWriteContext(_create, [obj])

const _create = (obj) => {
  obj.id = (idIndex++).toString()
  indexObject(obj)
  const editstate = {target: obj, keys: Object.keys(obj)}
  context.editedObjects.push(editstate)
  return obj
}

const editByRef = (target, arg) => {
  const editstate = {target, keys: []}
  context.editedObjects.push(editstate)
  for (const key in arg) {
    if (key !== 'id') {
      if (target.hasOwnProperty(key)) {
        unindexKeyValue(key, target[key], target)
      }
      target[key] = arg[key]
      indexKeyValue(key, target[key], target)
      editstate.keys.push(key)
    }
  }
}

export const edit = (...args) =>
  wrapWriteContext(_edit, [args])

const _edit = (args) => {
  const [editArgument] = args.slice(-1)
  const query = normalizeQuery(args.slice(0, -1))
  const selection = innerSelect(query)
  for (const o of selection) {
    editByRef(o, editArgument)
  }
}

const removeByRef = (target) => {
  unindexObject(target)
  context.editedObjects.push(target)
}

export const remove = (...args) =>
  wrapWriteContext(_remove, [args])

const _remove = (args) => {
  const query = normalizeQuery(args)
  const selection = innerSelect(query)
  for (const o of selection) {
    removeByRef(o)
    let editstate = {target: o, keys: Object.keys(o)}
    context.editedObjects.push(editstate)
  }
}

const innerSelect = ({valueQuery, functions}) => {
  var sets = []
  var selection = [];

  if (valueQuery.id) {
    return getIndexObject('id', valueQuery['id'])
  }

  for (let key in valueQuery) {
    let value = valueQuery[key]
    let indexEntry = getIndexObject(key, value)
    if (!indexEntry) {
      return selection
    }
    sets.push(indexEntry)
  }

  if (sets.length == 0) {
    // nothing in the valuequery, everything is selected
    selection = stateData.slice()
  } else {
    // sort and unify sets to get the working selection
    sets.sort((a, b) => a.length - b.length)
    selection = sets[0].slice()
    for (var i = 1; i < sets.length; i++) {
      let targetSet = sets[i]
      for (var j = 0; j < selection.length; j++) {
        let target = selection[j]
        if (!targetSet.includes(target)) {
          selection.splice(j, 1)
          j--
        }
      }
    }
  }

  for (const f of functions) {
    for (var i = 0; i < selection.length; i++) {
      let target = selection[i]
      if (!f(target)) {
        selection.splice(i, 1)
        i--
      }
    }
  }

  return selection
}

const testQueryInclusion = ({valueQuery, functions}, obj) => {
  for (let key in valueQuery) {
    if (obj[key] !== valueQuery[key]) {
      return false;
    }
  }
  for (const f of functions) {
    if (!f(obj)) {
      return false;
    }
  }
  return true
}

// true if any edits have been made to the filtered set
const testForFilteredEdit = (filterList, keys) => {
  for (const key of keys) {
    if (filterList.includes(key)) {
      return true
    }
  }
  return false
}

const testSubscription = (s) => {
  for (const sel of s.selectors) {
    for (const {target, keys} of context.editedObjects) {
      if (sel.lastSelection.includes(target)) {
        // object was previously in selection
        if (sel.filter) {
          // this is a filter, not a selection
          if (testForFilteredEdit(sel.filterList, keys)) {
            // the edit includes one of the filtered attributes
            return true
          }
        } else {
          return true;
        }
      } else {
        // object is outside of selection, test if it made it in
        if (testQueryInclusion(sel.query, target)) {
          // object is now in the selection
          if (sel.filter) {
            // this is a filter, not a selection
            if (testForFilteredEdit(sel.filterList, keys)) {
              // the edit includes one of the filtered attributes
              return true
            }
          } else {
            return true;
          }
        }
      }
    }
  }
  return false;
}

const commit = () => {
  // this is where we retrigger subscriptions
  // requires CAREFUL handling for potential unsubscriptions inside the process triggered by component updates
  // specifically, rendering components can modify the subscriptionTable in unpredictable ways,
  // check each against the subscriptionTable before the component update

  const subscriptionsToUpdate = []
  const nonhookSubscriptions = []
  const updatedComponents = []
  for (const sub of subscriptionTable) {
    if (testSubscription(sub)) {
      if (sub.hookMode) {
        subscriptionsToUpdate.push(sub)
      } else {
        nonhookSubscriptions.push(sub)
      }
    }
  }

  // done with context, reset it
  context = null

  for (const sub of nonhookSubscriptions) {
    nonhookUpdate(sub)
  }

  for (const sub of subscriptionsToUpdate) {
    hookUpdate(sub, sub.innerFunction, sub.lastDeps)
  }

  for (const sub of subscriptionsToUpdate) {
    if (!updatedComponents.includes(sub.component) && subscriptionTable.includes(sub)) {
      sub.component.forceUpdate()
      updatedComponents.push(sub.component)
    }
  }
}


// hooks/dispatch:

const hookUpdate = (state, query, deps) => {
  context = {writeContext: false, subscription: state}
  state.selectors = []
  state.lastValue = query() // this populates the selection argument itself
  context = null
  state.innerFunction = query // needed so writes can update the subscription
  state.lastDeps = deps
}

const compareDeps = (a, b) => {
  if (a.length !== b.length) {
    return false
  }
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

export const useSubscription = (query, deps = []) => {
  const state = useRef()
  useEffect(() => {
    return () => {
      subscriptionTable.splice(subscriptionTable.indexOf(state.current), 1)
    }
  }, [])
  if (!state.current) {
    // first render
    state.current = {selectors: [], component: currentComponent, lastDeps: deps, hookMode: true}
    subscriptionTable.push(state.current)
    hookUpdate(state.current, query, deps)
    return state.current.lastValue
  }
  if (!compareDeps(state.current.lastDeps, deps)) {
    hookUpdate(state.current, query, deps)
  }
  return state.current.lastValue
}

export const useSelection = (...args) => {
  var deps = [];
  let i = args.length - 1;
  if (args[i] instanceof Array) {
    deps = args[i]
    args.splice(i, 1)
  }
  const value = useSubscription(() => select(...args), deps)
  return value;
}

// todo: think about how deps would translate into edits
export const useLocalState = (obj) => {
  const state = useRef()
  useEffect(() => {
    return () => {
      subscriptionTable.splice(subscriptionTable.indexOf(state.current), 1)
      remove({id: state.current.target.id})
    }
  }, [])
  if (!state.current) {
    // first render
    state.current = {
      selectors: [],
      component: currentComponent,
      lastDeps: [],
      hookMode: true,
      target: create(obj),
      query: () => select({id: state.current.target.id}),
    }
    subscriptionTable.push(state.current)
    hookUpdate(state.current, state.current.query, [])
    return state.current.lastValue[0]
  }
  return state.current.lastValue[0]
}

const nonhookUpdate = (state) => {
  context = {writeContext: false, subscription: state}
  state.selectors = []
  state.callback(state.innerFunction())
  context = null
}

export const subscribe = (query, callback) => {
  const queryFunction = (state) => state.select(query)
  const state = {selectors: [], hookMode: false, innerFunction: queryFunction, callback}
  const option = {unsubscribe: () => subscriptionTable.splice(subscriptionTable.indexOf(state), 1)}
  subscriptionTable.push(state)
  nonhookUpdate(state)
  return option
}

export const groupUpdates = (query) => {
  if (context) {
    // already in a context!
    return query()
  } else {
    // create a context and commit after
    var result;
    context = {writeContext: true, editedObjects: []}
    result = query()
    commit()
    context = null
    return result;
  }
}
