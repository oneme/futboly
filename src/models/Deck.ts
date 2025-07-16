import type {Federation} from "@/models/Federation";
import type {Surprise} from "@/models/Surprise";

export class Deck {
    private cards: Federation[] | Surprise[];
    private readonly initial: any[];

    public constructor(cards: Federation[] | Surprise[]) {
        this.cards = this.shuffle(cards);
        this.initial = [...cards]
    }

    private shuffle(cards: Federation[] | Surprise[]): Federation[] | Surprise[] {
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        return cards;
    }

    public takeCard(): Federation | Surprise | undefined {
        if (this.cards.length === 0) {
            this.cards = this.shuffle([...this.initial]);
        }
        return this.cards.shift();
    }
}