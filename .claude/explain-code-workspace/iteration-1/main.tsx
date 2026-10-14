/**
 * 📌 이 파일은: 앱의 전원 버튼이에요. 앱이 켜질 때 가장 먼저 실행돼서, App.tsx에서 만든 화면을 웹페이지에 올려놓아요.
 *
 * 처음 보는 용어
 *  - import: 다른 파일이나 도구 모음에 있는 것을 이 파일로 가져와요.
 *  - React: 화면을 레고 블록(컴포넌트)처럼 조립해서 만들게 해 주는 도구 모음이에요.
 */

// React 도구와, 우리가 만든 앱(App), 앱 전체에 입힐 디자인(index.css)을 가져와요.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// index.html 안에는 id가 "root"인 빈 상자(<div id="root">)가 하나 있어요.
// 그 상자를 찾아서(getElementById) 그 안에 App을 그려 넣어요(render).
// 끝의 느낌표(!)는 "이 상자는 반드시 있어요"라고 알려주는 표시예요.
// React.StrictMode는 개발하는 동안 실수를 더 꼼꼼히 찾아 경고해 주는 검사 도우미예요. 화면에는 보이지 않아요.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
