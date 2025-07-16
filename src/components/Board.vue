<script setup lang="ts">

import {useBoxStore} from "@/stores/box";

import {useGameStore} from "@/stores/game";
import {Player} from "@/models/Player";
import {markRaw, onMounted, ref} from "vue";
import {Property} from "@/models/Property";
import {Department} from "@/models/Department";
import eventBus from "../event-bus";
import {Stadium} from "@/models/Stadium";
import {useModal} from "@/composables/useModal";


import {useLogStore} from "@/stores/log";

import {BoxPosition, DepartmentType, Position} from "@/types";
import VerticalBox from "@/components/VerticalBox.vue";
import HorizontalBox from "@/components/HorizontalBox.vue";
import PlayerPanel from "@/components/PlayerPanel.vue";
import Log from "@/components/Log.vue";
import Bid from "@/components/Bid.vue";
import Trade from "@/components/Trade.vue";
import Manage from "@/components/Manage.vue";
import {formatCurrency} from "@/utils";
import Dialog from "@/components/Dialog.vue";


const counterBox = useBoxStore();
const gameStore = useGameStore();
const logStore = useLogStore();

const dice1Path = ref('src/assets/dices/1.png');
const dice2Path = ref('src/assets/dices/1.png');
const dices = ref(0);
const modal = useModal();
onMounted(() => {
  eventBus.on('roll-dice', rollDice);
  eventBus.on('dispatch-action', e => dispatchAction(e));
  eventBus.on('manage', manage);
  gameStore.passTurn(<Player>gameStore.players[0]);
});
const manage = () => {
  modal.component.value = markRaw(Manage);
  modal.props.value = {
    player: <Player>gameStore.turn,
  }
  modal.showModal();
}
const rollDice = () => {
  const dice1 = Math.floor(Math.random() * 6) + 1;
  dice1Path.value = dice1Path.value.slice(0, 17) + dice1 + dice1Path.value.slice(18);
  const dice2 = Math.floor(Math.random() * 6) + 1;
  dice2Path.value = dice2Path.value.slice(0, 17) + dice2 + dice2Path.value.slice(18);
  dices.value = dice1 + dice2;
  const player = <Player>gameStore.turn;
  if (player.sanctioned) {
    if (dice1 == dice2) {
      player.sanctioned = false;
      updatePlayer(player, dice1, dice2);
    } else {
      gameStore.finishTurnSanctioned(player);
    }
  } else {
    updatePlayer(player, dice1, dice2);
  }
}
const updatePlayer = (player: Player, dice1: number, dice2: number): void => {
  player.position(dice1, dice2);
  counterBox.updateCurrent(player.pos);
  checkBox(player, dices.value);
}
const checkBox = (player: Player, dices: number) => {
  const box = counterBox.getPropertyOrDepartment;

  if (box instanceof Property) {
    const rent = gameStore.checkProperty(box, player, dices);
    if (rent > player.money) {
      showManageDialogDueInsufficientMoney(player, rent);
      modal.showModal();
    } else if (rent > 0) {
      player.pay(rent);
      logStore.addLog(`${player.name} ha pagado ${formatCurrency(rent)} en ${box.fullName}`);
    } else {
      logStore.addLog(`${player.name} ha sacado ${dices} y ha caído en ${box.fullName}`);
    }
  } else {
    checkDepartment(player.pos, <Department>box, player);
  }
}
const showManageDialogDueInsufficientMoney = (player: Player, amount: number) => {
  modal.component.value = markRaw(Manage);
  modal.props.value = {
    player: player,
    onPayDebt: payDebt(amount, player),
  }
  modal.showModal();
}
const payDebt = (debt: number, player: Player) => () => {
  if (player.money >= debt) {
    player.pay(debt);
  } else {
    player.bankrupt = true;
    gameStore.showControl = true;
  }
  modal.hideModal();
}
const dispatchAction = (args: any) => {
  const player = <Player>gameStore.turn;
  switch (args.action) {
    case 'buy':
      gameStore.buyProperty(args.property);
      break;
    case 'auction':
      modal.component.value = markRaw(Bid);
      modal.props.value = {
        property: args.property,
      }
      modal.showModal();
      break;
    case 'buyChairs':
      gameStore.buyChair(1, <Stadium>args.property);
      break;
    case 'sellChairs':
      gameStore.sellChair(1, <Stadium>args.property);
      break;
    case 'mortgage':
      gameStore.mortgage(args.property);
      break;
    case 'redeem':
      gameStore.redeem(args.property);
      break;
    case 'trade':
      modal.component.value = markRaw(Trade);
      modal.showModal();
      break;
    case 'finishTurn':
      if (args.property instanceof Property && !gameStore.propertyOwner(args.property)) {
        modal.component.value = markRaw(Bid);
        modal.props.value = {
          property: args.property,
        }
        modal.showModal();
      } else {
        gameStore.finishTurn(player);
      }
      break;
    case 'payBail':
      player.pay(5000);
      break;
    case 'roll':

      break;
    case 'useCard':
      player.handleAppeal(false);
      break;
  }
}
const restart = () => {
  gameStore.$reset();
  counterBox.$reset();
  logStore.$reset();
}
const handleBidClose = () => {
  gameStore.finishTurn(<Player>gameStore.turn);
  modal.hideModal();
}
const checkDepartment = (position: number, department: Department, player: Player) => {
  switch (position) {
    case BoxPosition.START:
      player.receive(20000);
      logStore.addLog(`${player.name} ha caído en ${department.name} e ingresa 20.000 Ptas.`)
      break;
    case BoxPosition.FINE:
      player.pay(20000);
      logStore.addLog(`${player.name} ha caído en ${department.name} y ha pagado una multa de 20.000 Ptas.`)
      break;
    case BoxPosition.BENCH:
      if (player.sanctioned) {
        const modal = useModal();
        modal.component.value = markRaw(Dialog);
        const options = [
          {action: 'payBail', title: 'pagar sanción'},
          {action: 'roll', title: 'tirar dados'},
        ];
        if (player.appeal) {
          options.push({action: 'useCard', title: 'usar carta'});
        }
        modal.props.value = {
          text: '¿Qué desea hacer?',
          options: options,
        }
        modal.showModal();
      }
      if (!player.doubles) {
        gameStore.finishTurn(player);
      }
      logStore.addLog(`${player.name} ha caído en ${department.name}, solo de visita`)
      break;
    case BoxPosition.PARKING:
      player.pay(1000);
      gameStore.chargeParking();
      logStore.addLog(`${player.name} ha caido en el parking`)
      break;
    case BoxPosition.GO_TO_BENCH:
      player.pos = BoxPosition.BENCH;
      player.sanctioned = true;
      logStore.addLog(`${player.name} va al banquillo`)
      break;
    case BoxPosition.CLUB_DAY:
      player.pay(10000);
      logStore.addLog(`${player.name} ha caído en el día del club y paga 10.000 Ptas`)
      break;
    default:
      const modal = useModal();
      if (department.type == DepartmentType.FEDERATION) {
        const federation = gameStore.federationCards.takeCard();
        if (federation) {
          modal.component.value = markRaw(Dialog);
          modal.props.value = {
            text: federation.text,
          }
          modal.showModal();
          const {method, args} = federation.action;
          if (method === 'chooseRisk') {
            gameStore.chooseRisk();
          } else if (method === 'collectForEachPlayer') {
            gameStore.collectFromEachPlayer(args[0]);
          } else if (method === 'pay') {
            const amount = args[0];
            if (amount > player.money) {
              showManageDialogDueInsufficientMoney(player, amount);
            } else {
              player.pay(amount);
            }
          } else {
            federation.executeAction(player);
          }
        }
      } else {
        const surprise = gameStore.surpriseCards.takeCard();
        if (surprise) {
          modal.component.value = markRaw(Dialog);
          modal.props.value = {
            text: surprise.text,
          }
          modal.showModal();
          const {method, args} = surprise.action;
          if (method === 'buildRepairs') {
            const amount = player.buildRepairs(args[0], args[1]);
            if (amount > player.money) {
              showManageDialogDueInsufficientMoney(player, amount);
            } else {
              player.pay(amount);
            }
          } else if (method === 'pay') {
            const amount = args[0];
            if (amount > player.money) {
              showManageDialogDueInsufficientMoney(player, amount);
            } else {
              player.pay(amount);
            }
          } else {
            surprise.executeAction(player);
          }
        }
      }
  }
}
</script>
<template>
  <div class="flex px-2 py-0.5 gap-2">
    <div class="grid grid-cols-[200px_repeat(11,95px)_200px] pt-1">
      <div class="h-32 rotate-180 bg-cover bg-center"
           :style="`background-image: url('${counterBox.boxes.top[0].kind.path}');`">
        <div class="flex h-full items-end pb-1">
          <img src="/src/assets/player-1.svg" alt="player-1" class="w-12 h-12 "
               v-show="counterBox.boxes.top[0]?.id == gameStore.players[0]?.pos">
          <img src="/src/assets/player-2.svg" alt="player-2" class="w-12 h-12 "
               v-show="counterBox.boxes.top[0]?.id == gameStore.players[1]?.pos">
        </div>
      </div>
      <vertical-box :box="box" :position="Position.TOP" v-for="box in counterBox.boxes.top.slice(1, -1)" :key="box.id"/>
      <div class="h-32 rotate-180 bg-cover bg-center"
           :style="`background-image: url('${counterBox.boxes.top[12].kind.path}');`">
        <div class="flex h-full items-end pb-1">
          <img src="/src/assets/player-1.svg" alt="player-1" class="w-12 h-12 "
               v-show="counterBox.boxes.top[12]?.id == gameStore.players[0]?.pos">
          <img src="/src/assets/player-2.svg" alt="player-2" class="w-12 h-12 "
               v-show="counterBox.boxes.top[12]?.id == gameStore.players[1]?.pos">
        </div>
      </div>
      <template v-for="index in 7" :key="index">
        <horizontal-box :position="Position.LEFT" :box="counterBox.boxes.left[index - 1]"/>
        <div class="col-start-2 col-end-13">
          <div class="flex justify-between" v-if="index === 4">
              <span class="flex">
                <img src="/src/assets/departments/card_surprise.png" alt="card"
                     class="h-[95px] border-4 border-dotted border-white rotate-90">
                <span class="text-center text-white font-semibold uppercase rotate-90 -ml-20">sorpresa</span>
              </span>
            <span class="flex">
              <span class="text-center text-white font-semibold uppercase rotate-90 -mr-4">federacion</span>
              <img src="/src/assets/departments/card_federation.png" alt="card"
                   class="h-[95px] rotate-90 border-4 border-dotted border-white">
            </span>
          </div>
          <Log v-if="index === 7"/>
        </div>
        <horizontal-box :position="Position.RIGHT" :box="counterBox.boxes.right[index - 1]"/>
      </template>
      <div class="h-32 bg-cover bg-center" :style="`background-image: url('${counterBox.boxes.bottom[0].kind.path}');`">
        <div class="flex h-full items-end pb-1">
          <img src="/src/assets/player-1.svg" alt="player-1" class="w-12 h-12 "
               v-show="counterBox.boxes.bottom[0]?.id == gameStore.players[0]?.pos">
          <img src="/src/assets/player-2.svg" alt="player-2" class="w-12 h-12 "
               v-show="counterBox.boxes.bottom[0]?.id == gameStore.players[1]?.pos">
        </div>
      </div>
      <vertical-box :box="box" :position="Position.BOTTOM" v-for="box in counterBox.boxes.bottom.slice(1, -1)"
                    :key="box.id"/>
      <div class="h-32 bg-cover bg-center"
           :style="`background-image: url('${counterBox.boxes.bottom[12].kind.path}');`">
        <div class="flex h-full items-end pb-1">
          <img src="/src/assets/player-1.svg" alt="player-1" class="w-12 h-12"
               v-show="counterBox.boxes.bottom[12]?.id == gameStore.players[0]?.pos">
          <img src="/src/assets/player-2.svg" alt="player-2" class="w-12 h-12"
               v-show="counterBox.boxes.bottom[12]?.id == gameStore.players[1]?.pos">
        </div>
      </div>
    </div>
    <PlayerPanel :dice1-path="dice1Path" :dice2-path="dice2Path" :player="<Player>gameStore.players[0]"/>
    <PlayerPanel :dice1-path="dice1Path" :dice2-path="dice2Path" :player="<Player>gameStore.players[1]"/>

  </div>
  <Teleport to="body">
    <Transition enter-active-class="duration-300" enter-from-class="opacity-0" enter-to-class="opacity-100"
                leave-active-class="duration-300" leave-to-class="opacity-0">
      <component :is="modal.component.value" v-if="modal.show.value" v-bind="modal.props.value"
                 @close="handleBidClose" @dismiss="modal.hideModal"/>
    </Transition>
  </Teleport>
</template>

