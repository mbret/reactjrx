const resetStyle = { backgroundColor: "transparent", color: "inherit" }

export function createLogger(env: string) {
  const _logger = {
    namespaces: [
      { name: "@reactjrx", style: { backgroundColor: "#d02f4e", color: "white" } }
    ],
    namespace(
      name: string,
      style?: { backgroundColor: string; color: string }
    ) {
      const logger = createLogger(env)
      logger.namespaces.push({
        name,
        style: style ?? resetStyle
      })

      return logger
    },
    printNamespaces() {
      return {
        namespaces: _logger.namespaces
          .map(({ name }) => `%c ${name} %c`)
          .join(" "),
        styles: _logger.namespaces.reduce<string[]>((acc, { style }) => {
          acc.push(
            `background-color: ${style.backgroundColor}; color: ${style.color};`
          )
          acc.push("background-color: transparent; color: inherit;")
          return acc
        }, [])
      }
    },
    print(method: "log" | "warn" | "error" | "group", ...message: any[]) {
      if (env === "development") {
        const { namespaces, styles } = _logger.printNamespaces()
        // eslint-disable-next-line no-console
        console[method](namespaces, ...styles, ...message)
      }
      return _logger
    },
    printWithoutNamespace(
      method: "log" | "warn" | "error" | "group",
      ...message: any[]
    ) {
      if (env === "development") {
        // eslint-disable-next-line no-console
        console[method](...message)
      }
      return _logger
    },
    log(...message: any) {
      return _logger.print("log", ...message)
    },
    warn(...message: any) {
      return _logger.print("warn", ...message)
    },
    error(...message: any) {
      return _logger.print("error", ...message)
    },
    group(...message: any) {
      return _logger.print("group", ...message)
    },
    groupEnd() {
      if (env === "development") {
        // eslint-disable-next-line no-console
        console.groupEnd()
      }
      return _logger
    }
  }

  return _logger
}

export const Logger = createLogger("development")
