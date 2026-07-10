import React, { useEffect, useState } from "react"
import ForgeReconciler, { Text } from "@forge/react"
import { invoke } from "@forge/bridge"

const App = () => {
  const [data, setData] = useState(null)

  useEffect(() => {
    invoke("getText", { example: "my-invoke-variable" }).then(setData)
  }, [])

  return (
    <>
      <Text>Hello world! yo</Text>
      <Text>This is test text. Is it working for you guys?</Text>
      <Text>{data ? data : "Loading..."}</Text>
    </>
  )
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
