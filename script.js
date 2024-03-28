const wordleText = async () => {
    const start = new Date('2021-06-19T11:59:59Z')
    const now = new Date()
    const diff = now - start
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    return `Wordle ${days.toLocaleString()} ?/6\n`
}

const connectionsText = async () => {
    const start = new Date('2023-06-11T11:59:59Z')
    const now = new Date()
    const diff = now - start
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    return `Connections\nPuzzle #${days.toLocaleString()}`
}

const strandsData = async () => {
    const today = new Date()
    const todayString = today.toISOString().split('T')[0]
    const data = await proxy(
        `https://www.nytimes.com/games-assets/strands/${todayString}.json`
    )
    const json = JSON.parse(data.body)
    console.log(json)
    return {
        text: `Strands #${json.id}\n\u201c${json.clue}\u201d`,
        count: Object.entries(json.themeCoords).length + 1,
    }
}

const wordle = () => ({
    width: 5,
    height: {
        mode: 'row',
        value: 4,
    },
    alphabet: ['2b1b', '1f7e8', '1f7e9'],
    data: Array(5 * 4).fill('2b1b'),
    modifiers: new Set(),
})

const strands = (n) => ({
    width: 4,
    height: {
        mode: 'count',
        value: n,
    },
    alphabet: ['1f535', '1f7e1', '1f4a1'],
    data: Array(n).fill('1f535'),
    modifiers: new Set(),
})

const connections = () => ({
    width: 4,
    height: {
        mode: 'row',
        value: 4,
    },
    alphabet: ['1f7e8', '1f7e9', '1f7e6', '1f7ea'],
    data: [
        ...Array(4).fill('1f7e8'),
        ...Array(4).fill('1f7e9'),
        ...Array(4).fill('1f7e6'),
        ...Array(4).fill('1f7ea'),
    ],
    modifiers: new Set(),
})

const audit = (oldState, newState) => {
    if (newState.width < 1) return oldState
    if (newState.height.value < 1) return oldState
    if (newState.alphabet.length < 1) return oldState
    return newState
}

const computeHeight = (state) => {
    if (state.height.mode === 'row') {
        return {
            rows: state.height.value,
            count: state.height.value * state.width,
        }
    } else {
        return {
            rows: Math.ceil(state.height.value / state.width),
            count: state.height.value,
        }
    }
}

const drawGrid = (state) => {
    const array = [[]]
    for (const emoji of state.data) {
        if (array.at(-1).length === state.width) {
            array.push([])
        }
        array.at(-1).push(emoji)
    }

    return array
}

const emptyGrid = (state) => {
    const { rows } = computeHeight(state)
    return Array(rows).fill().map(() => Array(state.width).fill())
}

const serializeGrid = (grid) => {
    const data = []
    for (const row of grid) {
        for (const cell of row) {
            if (cell) data.push(cell)
        }
    }
    return data
}

const render = (state) => {
    let callback
    const promise = new Promise((res) => { callback = res })

    // keyboard events

    window.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() === 'shift') {
            callback({
                action: 'press',
                data: 'shift',
            })
        }
    })

    window.addEventListener('keyup', (event) => {
        if (event.key.toLowerCase() === 'shift') {
            callback({
                action: 'release',
                data: 'shift',
            })
        }
    })

    // emoji grid

    const { rows } = computeHeight(state)

    const grid = document.createElement('div')
    grid.className = 'grid'
    grid.style.gridTemplateColumns = `repeat(${state.width}, 1fr)`
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`

    void state.data.forEach((emoji, i) => {
        if (emoji === undefined) return
        const img = document.createElement('img')
        img.className = 'square'
        img.src = `twemoji/${emoji}.svg`
        grid.appendChild(img)
        img.addEventListener('click', () => callback({
            action: 'cycle',
            data: i
        }))
    })

    // buttons

    const buttons = {
        'width': document.querySelector('.add-col'),
        'height': document.querySelector('.add-row'),
        'count': document.querySelector('.add-one'),
    }

    for (const [name, button] of Object.entries(buttons)) {
        button.addEventListener('click', () => callback({
            action: 'expand',
            data: name,
        }))
    }

    const symbol = state.modifiers.has('shift') ? '-' : '+'
    buttons.width.textContent = symbol
    buttons.height.textContent = symbol
    buttons.count.textContent = `${symbol}1`

    document.querySelector('.grid').replaceWith(grid)


    document.querySelector('.copy').addEventListener('click', () => {
        const text = document.querySelector('textarea').value
        callback({
            action: 'copy',
            data: text,
        })
    })

    document.querySelectorAll('.preset').forEach((button) => {
        button.addEventListener('click', () => {
            const name = button.getAttribute('data-preset')
            callback({
                action: 'preset',
                data: name,
            })
        })
    })

    return promise
}

const cycle = (state, i) => {
    const current = state.data[i]
    const index = state.alphabet.indexOf(current)
    const next = (index + 1) % state.alphabet.length

    const result = structuredClone(state)
    result.data[i] = state.alphabet[next]
    return result
}

const expand = (state, direction) => {
    const delta = state.modifiers.has('shift') ? -1 : 1

    const result = structuredClone(state)

    if (direction === 'width') result.width += delta
    if (direction === 'height') {
        const { rows } = computeHeight(state)
        result.height = {
            mode: 'row',
            value: rows + delta,
        }
    }
    if (direction === 'count') {
        const { count } = computeHeight(state)
        result.height = {
            mode: 'count',
            value: count + delta,
        }
    }

    if (result.height.mode === 'row') {
        const oldGrid = drawGrid(state)
        const newGrid = emptyGrid(result)

        const populated = newGrid.map((row, i) => (
            row.map((_e, j) => (
                oldGrid[i]?.[j] ?? state.alphabet[0]
            ))
        ))

        result.data = serializeGrid(populated)
    } else {
        if (delta === 1) result.data.push(state.alphabet[0])
        if (delta === -1) result.data.pop()
    }

    return result
}

const preset = async (state, data) => {
    const textarea = document.querySelector('textarea')
    textarea.value = 'Loading...'

    if (data === 'wordle') {
        textarea.value = await wordleText()
        state = wordle()
    }
    if (data === 'strands') {
        const { text, count } = await strandsData()
        console.log(count)
        textarea.value = text
        state = strands(count)
    }
    if (data === 'connections') {
        textarea.value = await connectionsText()
        state = connections()
    }
    return state
}

void (async () => {
    let state = await preset(null, 'wordle')
    while (true) {
        const { action, data } = await render(state)
        if (action === 'cycle') {
            state = audit(state, cycle(state, data))
        } else if (action === 'expand') {
            state = audit(state, expand(state, data))
        } else if (action === 'press') {
            state.modifiers.add(data)
        } else if (action === 'release') {
            state.modifiers.delete(data)
        } else if (action === 'copy') {
            const grid = drawGrid(state)
            const text = grid.map((row) => (
                row.map((emoji) => (
                    String.fromCodePoint(parseInt(emoji, 16))
                )).join('')
            )).join('\n')
            navigator.clipboard.writeText(`${data}\n${text}`)
        } else if (action === 'preset') {
            state = await preset(state, data)
        }
    }
})()
