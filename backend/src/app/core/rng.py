import random


class GameRng:
    def __init__(self, seed: int):
        self._rng = random.Random(seed)

    def randint(self, a: int, b: int) -> int:
        return self._rng.randint(a, b)

    def shuffle(self, values: list) -> None:
        self._rng.shuffle(values)

    def choice(self, values: list):
        return self._rng.choice(values)
