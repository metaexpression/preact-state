import { h, Component, render, options } from 'preact';
import { useEffect, useState, useRef, useContext, useCallback } from 'preact/hooks';
import base from './styles/base.css'
import { useSubscription, useSelection, create, edit, remove, select, filter } from './state'
import { useAnimation, AnimationTest } from './animate'
import { useMessageSystem } from './message'

const Todo = ({id}) => {
  const [data] = useSelection({id})
  const titleInputRef = useRef()

  useEffect(() => {
    if (data.justCreated) {
      titleInputRef.current.focus()
      edit(data, {justCreated: false})
    }
  }, [data])

  return (
    <div className="todocard">
      <div className="todosection">
        <input ref={titleInputRef} value={data.title} placeholder="Task title..." />
      </div>
    </div>
  )
}

const TodoApp = () => {
  const list = useSubscription(() => filter({type: 'todo'}, ['id']))
  const newItem = useCallback((e) => create({type: 'todo', title: "", text: "", subtasks: [], justCreated: true}), [])

  return (
    <div className="content">
      <div className="title">preact-sandbox<span onClick={newItem}>+</span></div>
      {list.map(x =>
        <Todo id={x.id} key={x.id} />
      )}
    </div>
  )
}

const AnimationApp = () => {
  return (
    <div className="content">
      <div className="title">preact-sandbox</div>
      <AnimationTest />
    </div>
  )
}

const MessageChild = () => {
  const components = useMessageSystem()
  const [number, setNumber] = useState(0)
  const add = useCallback((m) => setNumber(n => n + m), [])
  const subtract = useCallback((m) => setNumber(n => n - m), [])

  components.exportCallbacks({add, subtract})

  return (
    <div>{number}</div>
  )
}

const MessageChild2 = () => {
  const components = useMessageSystem()

  return (
    <div>foo</div>
  )
}

const MessageApp = () => {
  const components = useMessageSystem()
  const [state, setState] = useState('foo')
  const callback1 = useCallback((a) => setState(a))
  const callback2 = useCallback(() => state, [state])
  const click = useCallback(
    (e) => components.selectFromChildren({instance: MessageChild}).add(8),
    [],
  );

  return (
    <div className="content">
      <div onClick={click} className="title">preact-sandbox</div>
      <MessageChild />
      <MessageChild2 />
    </div>
  )
}

render(<AnimationApp />, document.body)
